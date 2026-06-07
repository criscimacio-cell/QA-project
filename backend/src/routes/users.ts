import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const avatarStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, 'avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${(req as any).user.userId}-${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.mimetype)) { cb(new Error('Only JPG, PNG, GIF, WEBP allowed')); return; }
    cb(null, true);
  },
});

const router = Router();

router.get('/', authenticate, requireRole('admin', 'lead', 'engineer'), (req: Request, res: Response) => {
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
  } catch {
    res.status(400).json({ error: 'Operation failed' });
  }
});

const VALID_ROLES = ['admin', 'lead', 'engineer', 'viewer'];

router.put('/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const { name, role, department, active } = req.body;
  if (parseInt(req.params.id) === req.user!.userId && role !== undefined) {
    res.status(403).json({ error: 'Cannot change your own role' }); return;
  }
  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: 'Invalid role' }); return;
  }
  db.prepare('UPDATE users SET name=?, role=?, department=?, active=? WHERE id=?').run(name, role, department, active !== undefined ? active : 1, req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'USER_UPDATE', 'user', ?, ?, ?)").run(req.user!.userId, req.params.id, `Updated user id=${req.params.id}`, req.ip || '');
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('UPDATE users SET active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Deactivated' });
});

// Upload avatar for logged-in user
router.put('/me/avatar', authenticate, avatarUpload.single('avatar'), (req: Request, res: Response) => {
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No image uploaded' }); return; }
  fs.mkdirSync(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });
  // Delete old avatar file if it was a local upload
  const existing = db.prepare('SELECT avatar FROM users WHERE id=?').get(req.user!.userId) as any;
  if (existing?.avatar?.startsWith('/api/users/') && existing.avatar.includes('/avatar')) {
    const oldPath = path.join(UPLOAD_DIR, 'avatars', path.basename(existing.avatar));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const avatarUrl = `/api/users/${req.user!.userId}/avatar?v=${Date.now()}`;
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatarUrl, req.user!.userId);
  res.json({ avatar: avatarUrl });
});

// Serve avatar image — no auth required (profile pictures are not sensitive)
router.get('/:id/avatar', (req: Request, res: Response) => {
  const user = db.prepare('SELECT avatar FROM users WHERE id=?').get(req.params.id) as any;
  if (!user) { res.status(404).end(); return; }
  // Find the avatar file for this user
  const avatarDir = path.join(UPLOAD_DIR, 'avatars');
  if (fs.existsSync(avatarDir)) {
    const files = fs.readdirSync(avatarDir).filter(f => f.startsWith(`avatar-${req.params.id}-`));
    if (files.length > 0) {
      // Serve the most recent one
      const latest = files.sort().at(-1)!;
      const filePath = path.join(avatarDir, latest);
      const ext = path.extname(latest).toLowerCase();
      const mime: Record<string,string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
      res.setHeader('Content-Type', mime[ext] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  // Fall back to redirect to dicebear
  res.redirect(user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.params.id}`);
});

export default router;
