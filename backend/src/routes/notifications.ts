import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();

router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const notifications = await sql`SELECT * FROM notifications WHERE user_id = ${req.user!.userId} AND organization_id = ${orgId} ORDER BY created_at DESC LIMIT 50`;
  const [{ c }] = await sql`SELECT COUNT(*)::int as c FROM notifications WHERE user_id = ${req.user!.userId} AND organization_id = ${orgId} AND read = FALSE`;
  res.json({ notifications, unread: c });
}));

router.post('/:id/read', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE id = ${req.params.id} AND user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'Marked as read' });
}));
router.put('/:id/read', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE id = ${req.params.id} AND user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'Marked as read' });
}));

router.post('/read-all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'All marked as read' });
}));
router.put('/read-all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'All marked as read' });
}));

export default router;
