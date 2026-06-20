import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sql from '../db';
import { authenticate, JWT_SECRET } from '../middleware/auth';
import { sendPasswordReset } from '../mailer';

const router = Router();

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

async function checkRateLimit(ip: string): Promise<boolean> {
  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count FROM audit_logs
    WHERE ip_address = ${ip}
      AND action = 'LOGIN_FAIL'
      AND created_at > NOW() - INTERVAL '15 minutes'
  ` as any[];
  return count < 5;
}

function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === '1') {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

router.post('/login', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!await checkRateLimit(ip)) { res.status(429).json({ error: 'Too many login attempts, try again in 15 minutes' }); return; }
  const { email, password, rememberMe } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }

  const [{ emailCount }] = await sql`
    SELECT COUNT(*)::int as "emailCount" FROM audit_logs
    WHERE details LIKE ${'%' + email + '%'}
      AND action = 'LOGIN_FAIL'
      AND created_at > NOW() - INTERVAL '15 minutes'
  ` as any[];
  if (emailCount >= 5) { res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' }); return; }

  const [user] = await sql`SELECT * FROM users WHERE email = ${email} AND active = TRUE`;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (0, 'LOGIN_FAIL', 'user', 0, ${`Failed login attempt for: ${email}`}, ${ip})`;
    res.status(401).json({ error: 'Invalid credentials' }); return;
  }
  await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${user.id}, 'LOGIN', 'user', ${user.id}, 'Successful login', ${req.ip || ''})`;

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const accessToken = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET(), { expiresIn: expiresIn as any, algorithm: 'HS256' });
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const accessTTL = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

  await sql`INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (${user.id}, ${refreshToken}, ${refreshExpiresAt.toISOString()})`;

  res.cookie('accessToken', accessToken, { ...ACCESS_COOKIE_OPTS, expires: new Date(Date.now() + accessTTL) });
  res.cookie('refreshToken', refreshToken, { ...REFRESH_COOKIE_OPTS, expires: refreshExpiresAt });

  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }
  const [record] = await sql`
    SELECT rt.*, u.id as uid, u.email, u.role FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ${token} AND rt.revoked = FALSE AND rt.expires_at > NOW() AND u.active = TRUE
  `;
  if (!record) { res.status(401).json({ error: 'Invalid or expired refresh token' }); return; }
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token = ${token}`;

  const newRefresh = crypto.randomBytes(64).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (${record.uid}, ${newRefresh}, ${refreshExpiresAt.toISOString()})`;

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const accessToken = jwt.sign({ userId: record.uid, email: record.email, role: record.role }, JWT_SECRET(), { expiresIn: expiresIn as any, algorithm: 'HS256' });

  res.cookie('accessToken', accessToken, { ...ACCESS_COOKIE_OPTS, expires: new Date(Date.now() + 8 * 60 * 60 * 1000) });
  res.cookie('refreshToken', newRefresh, { ...REFRESH_COOKIE_OPTS, expires: refreshExpiresAt });
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const [user] = await sql`SELECT id, name, email, role, department, avatar, active, created_at, last_login FROM users WHERE id = ${req.user!.userId}`;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token = ${token}`;
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'LOGOUT', 'user', ${req.user!.userId}, 'User logged out', ${req.ip || ''})`;
  res.json({ message: 'Logged out' });
});

router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) { res.status(400).json({ error: 'Both currentPassword and newPassword are required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'New password must be at least 8 characters' }); return; }
  const [user] = await sql`SELECT * FROM users WHERE id = ${req.user!.userId}`;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) { res.status(400).json({ error: 'Current password is incorrect' }); return; }
  await sql`UPDATE users SET password_hash = ${bcrypt.hashSync(newPassword, 10)} WHERE id = ${user.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${user.id}, 'PASSWORD_CHANGE', 'user', ${user.id}, 'Password changed', ${req.ip || ''})`;
  res.json({ message: 'Password changed successfully' });
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
  try {
    const [user] = await sql`SELECT * FROM users WHERE email = ${email} AND active = TRUE`;
    if (!user) { res.json({ message: 'If that email exists, a reset link has been sent.' }); return; }
    await sql`UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ${user.id}`;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await sql`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (${user.id}, ${token}, ${expiresAt})`;
    try { await sendPasswordReset(user.email, user.name, token); } catch (e) { console.error('Email send failed:', e); }
  } catch (e) { console.error('Forgot-password error:', e); }
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) { res.status(400).json({ error: 'Token and new password required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
  const [record] = await sql`
    SELECT prt.*, u.id as uid FROM password_reset_tokens prt
    JOIN users u ON prt.user_id = u.id
    WHERE prt.token = ${token} AND prt.used = FALSE AND prt.expires_at > NOW()
  `;
  if (!record) { res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' }); return; }
  await sql`UPDATE users SET password_hash = ${bcrypt.hashSync(newPassword, 10)} WHERE id = ${record.uid}`;
  await sql`UPDATE password_reset_tokens SET used = TRUE WHERE token = ${token}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${record.uid}, 'PASSWORD_RESET', 'user', ${record.uid}, 'Password reset via token', ${req.ip || ''})`;
  res.json({ message: 'Password reset successfully. You can now log in.' });
});

router.get('/reset-password/validate', async (req: Request, res: Response) => {
  const { token } = req.query;
  const [record] = await sql`SELECT id FROM password_reset_tokens WHERE token = ${token as string} AND used = FALSE AND expires_at > NOW()`;
  res.json({ valid: !!record });
});

export default router;
