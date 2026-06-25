import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();

// Generate a new TOTP secret and return QR code — does NOT enable MFA yet
router.post('/setup', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const [user] = await sql`SELECT email, name FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const totp = new OTPAuth.TOTP({
    issuer: 'Qlarity',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  const secret = totp.secret.base32;
  // Store pending secret (not yet enabled)
  await sql`UPDATE users SET totp_secret = ${secret}, totp_enabled = FALSE WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;

  const otpUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpUrl);

  res.json({ secret, qr: qrDataUrl, otpUrl });
}));

// Confirm the code from the authenticator app — enables MFA
router.post('/confirm', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: 'TOTP code required' }); return; }

  const [user] = await sql`SELECT email, totp_secret, totp_enabled FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  if (!user?.totp_secret) { res.status(400).json({ error: 'MFA setup not initiated. Call /setup first.' }); return; }
  if (user.totp_enabled) { res.status(400).json({ error: 'MFA already enabled' }); return; }

  const totp = new OTPAuth.TOTP({ issuer: 'Qlarity', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(user.totp_secret) });
  const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
  if (delta === null) { res.status(401).json({ error: 'Invalid code. Check your authenticator app and try again.' }); return; }

  await sql`UPDATE users SET totp_enabled = TRUE WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'MFA_ENABLED', 'user', ${req.user!.userId}, 'MFA enabled', ${req.ip || ''}, ${req.user!.organizationId})`;
  res.json({ message: 'MFA enabled successfully' });
}));

// Disable MFA — requires current password confirmation
router.post('/disable', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: 'Current password is required to disable MFA' }); return; }

  const [user] = await sql`SELECT password_hash, totp_enabled FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (!user.totp_enabled) { res.status(400).json({ error: 'MFA is not enabled' }); return; }
  if (!bcrypt.compareSync(password, user.password_hash)) { res.status(401).json({ error: 'Incorrect password' }); return; }

  await sql`UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'MFA_DISABLED', 'user', ${req.user!.userId}, 'MFA disabled', ${req.ip || ''}, ${req.user!.organizationId})`;
  res.json({ message: 'MFA disabled' });
}));

// Get MFA status for the current user
router.get('/status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const [user] = await sql`SELECT totp_enabled FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ enabled: !!user?.totp_enabled });
}));

export default router;
