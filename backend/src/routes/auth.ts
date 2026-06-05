import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db';
import { authenticate, JWT_SECRET } from '../middleware/auth';
import { sendPasswordReset } from '../mailer';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' }); return;
  }
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'LOGIN', 'user', ?, 'Successful login', ?)").run(user.id, user.id, req.ip || '');
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET(), { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any });
  const { password_hash, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = db.prepare('SELECT id, name, email, role, department, avatar, active, created_at, last_login FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

router.post('/logout', authenticate, (req: Request, res: Response) => {
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'LOGOUT', 'user', ?, 'User logged out', ?)").run(req.user!.userId, req.user!.userId, req.ip || '');
  res.json({ message: 'Logged out' });
});

router.post('/change-password', authenticate, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: 'New password must be at least 8 characters' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect' }); return;
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), user.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'PASSWORD_CHANGE', 'user', ?, 'Password changed', ?)").run(user.id, user.id, req.ip || '');
  res.json({ message: 'Password changed successfully' });
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any;
  // Always return success to prevent email enumeration
  if (!user) { res.json({ message: 'If that email exists, a reset link has been sent.' }); return; }

  // Invalidate old tokens
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

  try {
    await sendPasswordReset(user.email, user.name, token);
  } catch (e) {
    console.error('Email send failed:', e);
  }

  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) { res.status(400).json({ error: 'Token and new password required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }

  const record = db.prepare(`
    SELECT prt.*, u.id as uid FROM password_reset_tokens prt
    JOIN users u ON prt.user_id = u.id
    WHERE prt.token = ? AND prt.used = 0 AND prt.expires_at > datetime('now')
  `).get(token) as any;

  if (!record) { res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' }); return; }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), record.uid);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'PASSWORD_RESET', 'user', ?, 'Password reset via token', ?)").run(record.uid, record.uid, req.ip || '');

  res.json({ message: 'Password reset successfully. You can now log in.' });
});

// Validate reset token (for frontend to check before showing the form)
router.get('/reset-password/validate', (req: Request, res: Response) => {
  const { token } = req.query;
  const record = db.prepare("SELECT id FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')").get(token as string);
  res.json({ valid: !!record });
});

export default router;
