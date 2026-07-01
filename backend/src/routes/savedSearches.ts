import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  // Only scoped by user_id previously. Harmless while one user = one org, but
  // a cross-tenant leak the moment multi-org switching works (same user id,
  // different organization_id via JWT) — a switched-in user would see
  // another org's saved searches.
  const rows = await sql`SELECT * FROM saved_searches WHERE user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId} ORDER BY created_at DESC`;
  res.json(rows);
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  const { name, query, filters } = req.body;
  if (!name?.trim() || !query?.trim()) { res.status(400).json({ error: 'Name and query are required' }); return; }
  const [row] = await sql`
    INSERT INTO saved_searches (user_id, organization_id, name, query, filters)
    VALUES (${req.user!.userId}, ${req.user!.organizationId}, ${name.trim()}, ${query.trim()}, ${JSON.stringify(filters || {})})
    RETURNING *
  `;
  res.json(row);
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await sql`DELETE FROM saved_searches WHERE id = ${req.params.id} AND user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'Deleted' });
});

export default router;
