import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { type } = req.query;
  const cats = type
    ? await sql`SELECT * FROM categories WHERE type = ${type as string} ORDER BY name`
    : await sql`SELECT * FROM categories ORDER BY type, name`;
  res.json(cats);
});

router.post('/', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name, type = 'file' } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return; }
  await sql`INSERT INTO categories (name, type) VALUES (${name.trim()}, ${type as string}) ON CONFLICT DO NOTHING`;
  const [cat] = await sql`SELECT * FROM categories WHERE name = ${name.trim()} AND type = ${type as string}`;
  res.json(cat);
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  await sql`DELETE FROM categories WHERE id = ${req.params.id}`;
  res.json({ message: 'Deleted' });
});

export default router;
