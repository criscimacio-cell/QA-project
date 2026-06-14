import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const notifications = await sql`SELECT * FROM notifications WHERE user_id = ${req.user!.userId} ORDER BY created_at DESC LIMIT 50`;
  const [{ c }] = await sql`SELECT COUNT(*)::int as c FROM notifications WHERE user_id = ${req.user!.userId} AND read = FALSE`;
  res.json({ notifications, unread: c });
});

router.post('/:id/read', authenticate, async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE id = ${req.params.id} AND user_id = ${req.user!.userId}`;
  res.json({ message: 'Marked as read' });
});
router.put('/:id/read', authenticate, async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE id = ${req.params.id} AND user_id = ${req.user!.userId}`;
  res.json({ message: 'Marked as read' });
});

router.post('/read-all', authenticate, async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${req.user!.userId}`;
  res.json({ message: 'All marked as read' });
});
router.put('/read-all', authenticate, async (req: Request, res: Response) => {
  await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${req.user!.userId}`;
  res.json({ message: 'All marked as read' });
});

export default router;
