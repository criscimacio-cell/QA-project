import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();

router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const rows = await sql`SELECT * FROM saved_searches WHERE user_id = ${req.user!.userId} ORDER BY created_at DESC`;
  res.json(rows);
}));

router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { name, query, filters } = req.body;
  if (!name?.trim() || !query?.trim()) { res.status(400).json({ error: 'Name and query are required' }); return; }
  const [row] = await sql`
    INSERT INTO saved_searches (user_id, organization_id, name, query, filters)
    VALUES (${req.user!.userId}, ${req.user!.organizationId}, ${name.trim()}, ${query.trim()}, ${JSON.stringify(filters || {})})
    RETURNING *
  `;
  res.json(row);
}));

router.delete('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await sql`DELETE FROM saved_searches WHERE id = ${req.params.id} AND user_id = ${req.user!.userId}`;
  res.json({ message: 'Deleted' });
}));

export default router;
