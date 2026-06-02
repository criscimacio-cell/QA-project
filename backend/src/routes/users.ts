import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, email, role, department, avatar, active, created_at, last_login FROM users').all();
  res.json(users);
});

router.post('/', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const { name, email, password, role, department } = req.body;
  const hash = bcrypt.hashSync(password || 'password123', 10);
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role, department, avatar) VALUES (?, ?, ?, ?, ?, ?)').run(name, email, hash, role || 'viewer', department || '', avatar);
    db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'USER_CREATE', 'user', ?, ?, ?)").run(req.user!.userId, result.lastInsertRowid, `Created user: ${email}`, req.ip || '');
    res.json({ id: result.lastInsertRowid, name, email, role });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const { name, role, department, active } = req.body;
  db.prepare('UPDATE users SET name=?, role=?, department=?, active=? WHERE id=?').run(name, role, department, active !== undefined ? active : 1, req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'USER_UPDATE', 'user', ?, ?, ?)").run(req.user!.userId, req.params.id, `Updated user id=${req.params.id}`, req.ip || '');
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('UPDATE users SET active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Deactivated' });
});

export default router;
