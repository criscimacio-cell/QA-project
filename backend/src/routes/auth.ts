import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sql from '../db';
import { authenticate, JWT_SECRET } from '../middleware/auth';
import { sendPasswordResetEmail } from '../emailService';
import { logger } from '../logger';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const isProduction = process.env.NODE_ENV === 'production';

// Refresh tokens rotate on every use and each rotation resets the 7-day
// expiry, so a continuously active session would otherwise never be forced
// to re-authenticate. This caps total session lifetime from the original
// login regardless of activity — a stolen/leaked refresh token can't be
// ridden forever just by staying active.
// Read lazily (not at module load) — under tsx's dev transform, imports are
// evaluated before dotenv.config() runs (see emailService.ts's appUrl() for
// the same pattern), so an eager read here would silently ignore a value
// set only in .env and always fall back to the default in dev.
const sessionAbsoluteMaxMs = () => parseInt(process.env.SESSION_ABSOLUTE_MAX_DAYS || '30', 10) * 24 * 60 * 60 * 1000;

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: '/',
};

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: '/api/auth',
};


async function checkRateLimit(ip: string): Promise<boolean> {
  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count FROM audit_logs
    WHERE ip_address = ${ip}
      AND action = 'LOGIN_FAIL'
      AND created_at > NOW() - INTERVAL '15 minutes'
  ` as any[];
  return count < 20;
}

function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === '1') {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function signAccess(user: { id: number; email: string; role: string; organization_id: number }, expiresIn: string) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id },
    JWT_SECRET(),
    { expiresIn: expiresIn as any, algorithm: 'HS256' }
  );
}

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { email, password, rememberMe, orgSlug } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }

  let user: any;
  let resolvedOrgId: number | null = null;
  if (orgSlug) {
    const [org] = await sql`SELECT id FROM organizations WHERE slug = ${orgSlug} AND active = TRUE`;
    if (org) {
      resolvedOrgId = org.id;
      [user] = await sql`SELECT * FROM users WHERE email = ${email} AND organization_id = ${org.id}`;
    }
  } else {
    [user] = await sql`
      SELECT u.* FROM users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = ${email} AND o.active = TRUE
    `;
    if (user) resolvedOrgId = user.organization_id;
  }

  const passwordOk = !!user && await bcrypt.compare(password, user.password_hash);

  // Throttling only ever applies to WRONG credentials. Gating this before we
  // even check the password meant one attacker sending 20 wrong guesses (at
  // one email, from one IP) locked out every other account sharing that IP,
  // or every org sharing that email, even with the correct password. A
  // correct password must never be blocked by someone else's failed attempts.
  if (!passwordOk) {
    if (!await checkRateLimit(ip)) { res.status(429).json({ error: 'Too many login attempts, try again in 15 minutes' }); return; }
    const [{ emailCount }] = await sql`
      SELECT COUNT(*)::int as "emailCount" FROM audit_logs
      WHERE details LIKE ${'%' + email + '%'}
        AND action = 'LOGIN_FAIL'
        AND ip_address = ${ip}
        AND created_at > NOW() - INTERVAL '15 minutes'
    ` as any[];
    if (emailCount >= 20) { res.status(429).json({ error: 'Too many failed attempts for this account from your network. Try again in 15 minutes.' }); return; }

    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user?.id || null}, 'LOGIN_FAIL', 'user', 0, ${`Failed login attempt for: ${email}`}, ${ip}, ${resolvedOrgId})`;
    res.status(401).json({ error: 'Invalid credentials' }); return;
  }
  if (!user.active) {
    res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' }); return;
  }

  await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user.id}, 'LOGIN', 'user', ${user.id}, 'Successful login', ${req.ip || ''}, ${user.organization_id})`;

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const accessToken = signAccess(user, expiresIn);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const accessTTL = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

  await sql`INSERT INTO refresh_tokens (user_id, token, expires_at, organization_id, first_issued_at) VALUES (${user.id}, ${refreshToken}, ${refreshExpiresAt.toISOString()}, ${user.organization_id}, NOW())`;

  res.cookie('accessToken', accessToken, { ...ACCESS_COOKIE_OPTS, expires: new Date(Date.now() + accessTTL) });
  res.cookie('refreshToken', refreshToken, { ...REFRESH_COOKIE_OPTS, expires: refreshExpiresAt });

  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
}));

router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }
  const [record] = await sql`
    SELECT rt.*, u.id as uid, u.email, u.role, u.organization_id, u.active FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    JOIN organizations o ON u.organization_id = o.id
    WHERE rt.token = ${token} AND rt.revoked = FALSE AND rt.expires_at > NOW()
      AND u.active = TRUE AND o.active = TRUE
      AND rt.organization_id = u.organization_id
  `;
  if (!record) { res.status(401).json({ error: 'Invalid or expired refresh token' }); return; }
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token = ${token}`;

  const sessionAgeMs = Date.now() - new Date(record.first_issued_at).getTime();
  if (sessionAgeMs > sessionAbsoluteMaxMs()) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(401).json({ error: 'Session expired, please log in again' });
    return;
  }

  const newRefresh = crypto.randomBytes(64).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO refresh_tokens (user_id, token, expires_at, organization_id, first_issued_at) VALUES (${record.uid}, ${newRefresh}, ${refreshExpiresAt.toISOString()}, ${record.organization_id}, ${record.first_issued_at})`;

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const accessToken = jwt.sign(
    { userId: record.uid, email: record.email, role: record.role, organizationId: record.organization_id },
    JWT_SECRET(),
    { expiresIn: expiresIn as any, algorithm: 'HS256' }
  );

  res.cookie('accessToken', accessToken, { ...ACCESS_COOKIE_OPTS, expires: new Date(Date.now() + 8 * 60 * 60 * 1000) });
  res.cookie('refreshToken', newRefresh, { ...REFRESH_COOKIE_OPTS, expires: refreshExpiresAt });
  res.json({ ok: true });
}));

router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const [user] = await sql`
    SELECT u.id, u.name, u.email, u.role, u.department, u.avatar, u.active, u.created_at, u.last_login,
           u.organization_id, o.slug as org_slug, o.name as org_name, o.plan as org_plan
    FROM users u JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = ${req.user!.userId} AND u.organization_id = ${req.user!.organizationId}
  `;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
}));

router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token = ${token} AND organization_id = ${req.user!.organizationId}`;
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'LOGOUT', 'user', ${req.user!.userId}, 'User logged out', ${req.ip || ''}, ${req.user!.organizationId})`;
  res.json({ message: 'Logged out' });
}));

router.post('/change-password', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) { res.status(400).json({ error: 'Both currentPassword and newPassword are required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'New password must be at least 8 characters' }); return; }
  const [user] = await sql`SELECT * FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) { res.status(400).json({ error: 'Current password is incorrect' }); return; }
  await sql`UPDATE users SET password_hash = ${bcrypt.hashSync(newPassword, 10)} WHERE id = ${user.id} AND organization_id = ${req.user!.organizationId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user.id}, 'PASSWORD_CHANGE', 'user', ${user.id}, 'Password changed', ${req.ip || ''}, ${req.user!.organizationId})`;
  res.json({ message: 'Password changed successfully' });
}));

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email, orgSlug } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
  try {
    let user: any;
    if (orgSlug) {
      const [org] = await sql`SELECT id FROM organizations WHERE slug = ${orgSlug} AND active = TRUE`;
      if (org) {
        [user] = await sql`SELECT * FROM users WHERE email = ${email} AND organization_id = ${org.id} AND active = TRUE`;
      }
    } else {
      [user] = await sql`SELECT * FROM users WHERE email = ${email} AND active = TRUE`;
    }
    if (!user) { res.json({ message: 'If that email exists, a reset link has been sent.' }); return; }
    await sql`UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ${user.id}`;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await sql`INSERT INTO password_reset_tokens (user_id, token, expires_at, organization_id) VALUES (${user.id}, ${token}, ${expiresAt}, ${user.organization_id})`;
    try { await sendPasswordResetEmail(user.email, user.name, token); } catch (e) { logger.error({ err: e }, 'Email send failed'); }
  } catch (e) { logger.error({ err: e }, 'Forgot-password error'); }
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) { res.status(400).json({ error: 'Token and new password required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
  const [record] = await sql`
    SELECT prt.*, u.id as uid, u.organization_id FROM password_reset_tokens prt
    JOIN users u ON prt.user_id = u.id
    WHERE prt.token = ${token} AND prt.used = FALSE AND prt.expires_at > NOW()
  `;
  if (!record) { res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' }); return; }
  await sql`UPDATE users SET password_hash = ${bcrypt.hashSync(newPassword, 10)} WHERE id = ${record.uid}`;
  await sql`UPDATE password_reset_tokens SET used = TRUE WHERE token = ${token}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${record.uid}, 'PASSWORD_RESET', 'user', ${record.uid}, 'Password reset via token', ${req.ip || ''}, ${record.organization_id})`;
  res.json({ message: 'Password reset successfully. You can now log in.' });
});

router.get('/reset-password/validate', async (req: Request, res: Response) => {
  const { token } = req.query;
  const [record] = await sql`SELECT id FROM password_reset_tokens WHERE token = ${token as string} AND used = FALSE AND expires_at > NOW()`;
  res.json({ valid: !!record });
});

// GET /auth/orgs — list all orgs the current user belongs to
router.get('/orgs', authenticate, asyncHandler(async (req, res) => {
  const orgs = await sql`
    SELECT o.id, o.name, o.slug, o.plan, m.role
    FROM user_org_memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ${req.user!.userId} AND m.active = TRUE AND o.active = TRUE AND o.archived_at IS NULL
    ORDER BY o.name
  `;
  res.json(orgs);
}));

// POST /auth/switch-org — switch to a different org
router.post('/switch-org', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.body;
  const [membership] = await sql`
    SELECT m.role, o.id, o.name, o.slug, o.plan
    FROM user_org_memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ${req.user!.userId} AND m.organization_id = ${organizationId}
      AND m.active = TRUE AND o.active = TRUE
  `;
  if (!membership) { res.status(403).json({ error: 'Not a member of this organization' }); return; }

  // Issue new token with new org
  const [user] = await sql`SELECT * FROM users WHERE id = ${req.user!.userId}`;
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: membership.role, organizationId: membership.id, orgSlug: membership.slug },
    JWT_SECRET(),
    { expiresIn: '8h', algorithm: 'HS256' }
  );
  res.cookie('accessToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', expires: new Date(Date.now() + 8*60*60*1000) });
  res.json({ message: 'Switched organization', org: { id: membership.id, name: membership.name, slug: membership.slug } });
}));

router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, '[auth]');
  res.status(500).json({ error: 'Internal server error' });
});

export default router;
