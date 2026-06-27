import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import asyncHandler from '../utils/asyncHandler';


const router = Router();

router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.query;
  const orgId = req.user!.organizationId;
  const cats = type
    ? await sql`SELECT * FROM categories WHERE type = ${type as string} AND organization_id = ${orgId} ORDER BY name`
    : await sql`SELECT * FROM categories WHERE organization_id = ${orgId} ORDER BY type, name`;
  res.json(cats);
}));

router.post('/', authenticate, requireRole('admin', 'lead', 'engineer'), asyncHandler(async (req: Request, res: Response) => {
  const { name, type = 'file' } = req.body;
  const orgId = req.user!.organizationId;
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return; }
  await sql`INSERT INTO categories (name, type, organization_id) VALUES (${name.trim()}, ${type as string}, ${orgId}) ON CONFLICT DO NOTHING`;
  const [cat] = await sql`SELECT * FROM categories WHERE name = ${name.trim()} AND type = ${type as string} AND organization_id = ${orgId}`;
  res.json(cat);
}));

router.delete('/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [cat] = await sql`SELECT name FROM categories WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!cat) { res.status(404).json({ error: 'Not found' }); return; }
  // Clear this category from all files that reference it
  await sql`UPDATE files SET category = '' WHERE category = ${cat.name} AND organization_id = ${orgId}`;
  await sql`DELETE FROM categories WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'CATEGORY_DELETE', 'category', ${req.params.id}, ${`Deleted category: ${cat.name}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Deleted' });
}));

export default router;
