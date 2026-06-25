import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sql from '../db';
import { redis } from '../redis';
import { authenticate, JWT_SECRET } from '../middleware/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../emailService';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const isProduction = process.env.NODE_ENV === 'production';

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

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{2}$/;

async function incrementLoginFailure(ip: string, email: string): Promise<void> {
  const ipKey = `login_fail_ip:${ip}`;
  const emailKey = `login_fail_email:${email.toLowerCase()}`;
  await Promise.all([
    redis.multi().incr(ipKey).expire(ipKey, 15 * 60).exec(),
    redis.multi().incr(emailKey).expire(emailKey, 15 * 60).exec(),
  ]);
}

async function clearLoginFailures(ip: string, email: string): Promise<void> {
  await Promise.all([
    redis.del(`login_fail_ip:${ip}`),
    redis.del(`login_fail_email:${email.toLowerCase()}`),
  ]);
}

async function checkRateLimit(ip: string, email: string): Promise<boolean> {
  const [ipFails, emailFails] = await Promise.all([
    redis.get(`login_fail_ip:${ip}`),
    redis.get(`login_fail_email:${email.toLowerCase()}`),
  ]);
  return parseInt(ipFails || '0') < 20 && parseInt(emailFails || '0') < 10;
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

  if (!await checkRateLimit(ip, email)) {
    res.status(429).json({ error: 'Too many login attempts, try again in 15 minutes' }); return;
  }

  let user: any;
  let resolvedOrgId: number | null = null;
  if (orgSlug) {
    const [org] = await sql`SELECT id FROM organizations WHERE slug = ${orgSlug} AND active = TRUE`;
    if (!org) {
      await incrementLoginFailure(ip, email);
      await sql`INSERT INTO audit_logs (action, entity_type, entity_id, details, ip_address) VALUES ('LOGIN_FAIL', 'user', 0, ${`Failed login: unknown org slug "${orgSlug}" for ${email}`}, ${ip})`;
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }
    resolvedOrgId = org.id;
    [user] = await sql`SELECT * FROM users WHERE email = ${email} AND organization_id = ${org.id}`;
  } else {
    [user] = await sql`
      SELECT u.* FROM users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = ${email} AND o.active = TRUE
    `;
    if (user) resolvedOrgId = user.organization_id;
  }

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await incrementLoginFailure(ip, email);
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user?.id || null}, 'LOGIN_FAIL', 'user', 0, ${`Failed login attempt for: ${email}`}, ${ip}, ${resolvedOrgId})`;
    res.status(401).json({ error: 'Invalid credentials' }); return;
  }
  if (!user.active) {
    res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' }); return;
  }

  await clearLoginFailures(ip, email);
  await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user.id}, 'LOGIN', 'user', ${user.id}, 'Successful login', ${req.ip || ''}, ${user.organization_id})`;

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const accessToken = signAccess(user, expiresIn);
  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const refreshToken = hashToken(rawRefresh);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const accessTTL = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

  await sql`INSERT INTO refresh_tokens (user_id, token, expires_at, organization_id) VALUES (${user.id}, ${refreshToken}, ${refreshExpiresAt.toISOString()}, ${user.organization_id})`;

  res.cookie('accessToken', accessToken, { ...ACCESS_COOKIE_OPTS, expires: new Date(Date.now() + accessTTL) });
  res.cookie('refreshToken', rawRefresh, { ...REFRESH_COOKIE_OPTS, expires: refreshExpiresAt });

  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
}));

router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) { res.status(401).json({ error: 'No refresh token' }); return; }
  const tokenHash = hashToken(rawToken);
  const [record] = await sql`
    SELECT rt.*, u.id as uid, u.email, u.role, u.organization_id, u.active FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    JOIN organizations o ON u.organization_id = o.id
    WHERE rt.token = ${tokenHash} AND rt.revoked = FALSE AND rt.expires_at > NOW()
      AND u.active = TRUE AND o.active = TRUE
      AND rt.organization_id = u.organization_id
  `;
  if (!record) { res.status(401).json({ error: 'Invalid or expired refresh token' }); return; }
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token = ${tokenHash}`;

  const rawNewRefresh = crypto.randomBytes(64).toString('hex');
  const newRefreshHash = hashToken(rawNewRefresh);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO refresh_tokens (user_id, token, expires_at, organization_id) VALUES (${record.uid}, ${newRefreshHash}, ${refreshExpiresAt.toISOString()}, ${record.organization_id})`;

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const accessToken = jwt.sign(
    { userId: record.uid, email: record.email, role: record.role, organizationId: record.organization_id },
    JWT_SECRET(),
    { expiresIn: expiresIn as any, algorithm: 'HS256' }
  );

  res.cookie('accessToken', accessToken, { ...ACCESS_COOKIE_OPTS, expires: new Date(Date.now() + 8 * 60 * 60 * 1000) });
  res.cookie('refreshToken', rawNewRefresh, { ...REFRESH_COOKIE_OPTS, expires: refreshExpiresAt });
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
  const rawToken = req.cookies?.refreshToken;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token = ${tokenHash} AND organization_id = ${req.user!.organizationId}`;
  }
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
  // Revoke all refresh tokens — forces all other sessions to re-authenticate
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ${user.id}`;
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user.id}, 'PASSWORD_CHANGE', 'user', ${user.id}, 'Password changed — all sessions revoked', ${req.ip || ''}, ${req.user!.organizationId})`;
  res.json({ message: 'Password changed successfully. Please log in again.' });
}));

router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email, orgSlug } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

  // Rate-limit forgot-password requests per email (5 per 15 min)
  const ip = getClientIp(req);
  const [{ fpCount }] = await sql`
    SELECT COUNT(*)::int as "fpCount" FROM audit_logs
    WHERE (details LIKE ${'%' + email + '%'} OR ip_address = ${ip})
      AND action = 'PASSWORD_RESET_REQUEST'
      AND created_at > NOW() - INTERVAL '15 minutes'
  ` as any[];
  if (fpCount >= 5) {
    res.json({ message: 'If that email exists, a reset link has been sent.' }); return;
  }

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
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store SHA-256 hash — if DB is compromised, tokens in email are still safe
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await sql`INSERT INTO password_reset_tokens (user_id, token, expires_at, organization_id) VALUES (${user.id}, ${tokenHash}, ${expiresAt}, ${user.organization_id})`;
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${user.id}, 'PASSWORD_RESET_REQUEST', 'user', ${user.id}, ${`Password reset requested for: ${email}`}, ${ip}, ${user.organization_id})`.catch(() => {});
    try { await sendPasswordResetEmail(user.email, user.name, rawToken); } catch (e) { console.error('Email send failed:', e); }
  } catch (e) { console.error('Forgot-password error:', e); }
  res.json({ message: 'If that email exists, a reset link has been sent.' });
}));

router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) { res.status(400).json({ error: 'Token and new password required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [record] = await sql`
    SELECT prt.*, u.id as uid, u.organization_id FROM password_reset_tokens prt
    JOIN users u ON prt.user_id = u.id
    WHERE prt.token = ${tokenHash} AND prt.used = FALSE AND prt.expires_at > NOW()
  `;
  if (!record) { res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' }); return; }
  await sql`UPDATE users SET password_hash = ${bcrypt.hashSync(newPassword, 10)} WHERE id = ${record.uid}`;
  await sql`UPDATE password_reset_tokens SET used = TRUE WHERE token = ${tokenHash}`;
  // Revoke all active sessions — someone just proved control of the email
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ${record.uid}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${record.uid}, 'PASSWORD_RESET', 'user', ${record.uid}, 'Password reset via token — all sessions revoked', ${req.ip || ''}, ${record.organization_id})`;
  res.json({ message: 'Password reset successfully. You can now log in.' });
}));

router.get('/reset-password/validate', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token) { res.json({ valid: false }); return; }
  const tokenHash = crypto.createHash('sha256').update(token as string).digest('hex');
  const [record] = await sql`SELECT id FROM password_reset_tokens WHERE token = ${tokenHash} AND used = FALSE AND expires_at > NOW()`;
  res.json({ valid: !!record });
}));

router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { orgName, orgSlug, plan, adminName, adminEmail, adminPassword } = req.body;
  const validPlans = ['free', 'pro', 'enterprise'];
  const orgPlan = validPlans.includes(plan) ? plan : 'free';

  if (!orgName?.trim() || !orgSlug?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    res.status(400).json({ error: 'All fields are required' }); return;
  }
  if (!SLUG_RE.test(orgSlug)) {
    res.status(400).json({ error: 'Organization ID must be 2-50 characters, lowercase letters, numbers, and hyphens only (cannot start or end with a hyphen)' }); return;
  }
  if (adminPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' }); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
    res.status(400).json({ error: 'Invalid email address' }); return;
  }

  try {
    const result = await sql.begin(async tx => {
      const [existingSlug] = await tx`SELECT id FROM organizations WHERE slug = ${orgSlug.trim().toLowerCase()}`;
      if (existingSlug) throw new Error('SLUG_TAKEN');

      const [org] = await tx`
        INSERT INTO organizations (name, slug, plan) VALUES (${orgName.trim()}, ${orgSlug.trim().toLowerCase()}, ${orgPlan})
        RETURNING id
      `;

      const hash = bcrypt.hashSync(adminPassword, 10);
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(adminEmail.trim())}`;
      const [user] = await tx`
        INSERT INTO users (name, email, password_hash, role, organization_id, avatar)
        VALUES (${adminName.trim()}, ${adminEmail.trim().toLowerCase()}, ${hash}, 'admin', ${org.id}, ${avatar})
        RETURNING id
      `;

      await tx`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id)
               VALUES (${user.id}, 'ORG_REGISTER', 'organization', ${org.id}, ${`Organization "${orgName.trim()}" created`}, ${req.ip || ''}, ${org.id})`;

      return { orgId: org.id, userId: user.id };
    });

    try { await sendWelcomeEmail(adminEmail.trim().toLowerCase(), adminName.trim(), orgName.trim()); } catch (e) { console.error('Welcome email failed:', e); }

    res.status(201).json({ message: 'Organization created successfully. You can now log in.', orgId: result.orgId });
  } catch (err: any) {
    if (err.message === 'SLUG_TAKEN') {
      res.status(409).json({ error: 'That organization ID is already taken. Please choose another.' }); return;
    }
    if (err.code === '23505') {
      res.status(409).json({ error: 'An account with that email already exists in this organization.' }); return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}));

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
  console.error('[auth]', err?.message ?? err);
  res.status(500).json({ error: 'Internal server error' });
});

export default router;
