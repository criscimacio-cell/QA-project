import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /categories?type=file  (or type=knowledge)
router.get('/', authenticate, (req: Request, res: Response) => {
  const { type } = req.query;
  const cats = type
    ? db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type)
    : db.prepare('SELECT * FROM categories ORDER BY type, name').all();
  res.json(cats);
});

// POST /categories  — create if not exists, return the category
router.post('/', authenticate, requireRole('admin', 'lead', 'engineer'), (req: Request, res: Response) => {
  const { name, type = 'file' } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return; }
  db.prepare('INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)').run(name.trim(), type);
  const cat = db.prepare('SELECT * FROM categories WHERE name = ? AND type = ?').get(name.trim(), type);
  res.json(cat);
});

// DELETE /categories/:id  (admin only)
router.delete('/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;
