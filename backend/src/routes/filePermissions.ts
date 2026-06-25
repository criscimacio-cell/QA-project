import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();

router.get('/:id/permissions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id, owner_id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const perms = await sql`
    SELECT fp.id, fp.permission, fp.created_at,
           u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role
    FROM file_permissions fp
    JOIN users u ON fp.user_id = u.id
    WHERE fp.file_id = ${req.params.id}
    ORDER BY u.name
  `;
  res.json(perms);
}));

router.post('/:id/permissions', authenticate, requireRole('admin', 'lead'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { user_id, permission } = req.body;
  if (!user_id || !['view', 'edit', 'none'].includes(permission)) {
    res.status(400).json({ error: 'Invalid request. permission must be view|edit|none' }); return;
  }
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const [user] = await sql`SELECT id, name FROM users WHERE id = ${user_id} AND organization_id = ${orgId}`;
  if (!user) { res.status(404).json({ error: 'User not found in org' }); return; }

  const [perm] = await sql`
    INSERT INTO file_permissions (file_id, user_id, permission, granted_by, organization_id)
    VALUES (${req.params.id}, ${user_id}, ${permission}, ${req.user!.userId}, ${orgId})
    ON CONFLICT (file_id, user_id) DO UPDATE SET permission = ${permission}
    RETURNING *
  `;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'FILE_PERMISSION_GRANT', 'file', ${req.params.id}, ${`Set ${permission} permission for user ${user.name} (id=${user_id})`}, ${req.ip || ''}, ${orgId})`;
  res.json(perm);
}));

router.delete('/:id/permissions/:permId', authenticate, requireRole('admin', 'lead'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`DELETE FROM file_permissions WHERE id = ${req.params.permId} AND file_id = ${req.params.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'FILE_PERMISSION_REVOKE', 'file', ${req.params.id}, ${`Revoked permission entry id=${req.params.permId}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Permission removed' });
}));

export default router;
