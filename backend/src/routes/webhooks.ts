import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const VALID_EVENTS = [
  'file.uploaded', 'file.approved', 'file.rejected', 'file.published',
  'file.archived', 'file.deleted', 'user.created', 'comment.added'
];

// List webhooks for org
router.get('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const hooks = await sql`
    SELECT w.*, u.name as creator_name
    FROM webhooks w
    LEFT JOIN users u ON w.created_by = u.id
    WHERE w.organization_id = ${req.user!.organizationId}
    ORDER BY w.created_at DESC
  `;
  res.json(hooks);
});

// Create webhook
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { url, events, secret } = req.body;
  if (!url?.trim()) { res.status(400).json({ error: 'URL is required' }); return; }
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    res.status(400).json({ error: 'URL must start with http:// or https://' }); return;
  }
  const eventsStr = Array.isArray(events) ? events.filter(e => VALID_EVENTS.includes(e)).join(',') : 'file.approved';
  const [hook] = await sql`
    INSERT INTO webhooks (organization_id, created_by, url, events, secret)
    VALUES (${req.user!.organizationId}, ${req.user!.userId}, ${url.trim()}, ${eventsStr}, ${secret || null})
    RETURNING *
  `;
  res.json(hook);
});

// Toggle webhook active
router.patch('/:id/toggle', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const [hook] = await sql`SELECT id, active FROM webhooks WHERE id = ${req.params.id} AND organization_id = ${req.user!.organizationId}`;
  if (!hook) { res.status(404).json({ error: 'Webhook not found' }); return; }
  const [updated] = await sql`UPDATE webhooks SET active = ${!hook.active} WHERE id = ${req.params.id} RETURNING *`;
  res.json(updated);
});

// Delete webhook
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  await sql`DELETE FROM webhooks WHERE id = ${req.params.id} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'Webhook deleted' });
});

export { VALID_EVENTS };
export default router;
