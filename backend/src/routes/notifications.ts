import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user!.userId);
  const unread = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(req.user!.userId) as any).c;
  res.json({ notifications, unread });
});

router.post('/:id/read', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId);
  res.json({ message: 'Marked as read' });
});

router.post('/read-all', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.userId);
  res.json({ message: 'All marked as read' });
});

export default router;
