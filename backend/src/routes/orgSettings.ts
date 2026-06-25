import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate, requireRole, RESERVED_ROLE_NAMES } from '../middleware/auth';
import sql from '../db';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();

export const ADMIN_PERMISSIONS: Record<string, boolean> = {
  dashboard: true, repositories: true, files: true, search: true,
  knowledge: true, testData: true, approvals: true, archive: true,
  audit: true, users: true, settings: true, orgSettings: true,
};

router.get('/permissions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const stored = org?.role_permissions || {};
  res.json({ admin: ADMIN_PERMISSIONS, ...stored });
}));

router.put('/permissions', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { permissions } = req.body;
  const validModules = ['dashboard','repositories','files','search','knowledge','testData','approvals','archive','audit','users','settings','orgSettings'];

  const current = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const existing = current[0]?.role_permissions || {};

  const cleaned: Record<string, Record<string, boolean>> = {};
  const roleNames = Object.keys({ ...existing, ...permissions }).filter(r => r !== 'admin');
  for (const role of roleNames) {
    const perms = permissions[role] ?? existing[role] ?? {};
    cleaned[role] = {};
    for (const mod of validModules) {
      cleaned[role][mod] = typeof perms[mod] === 'boolean' ? perms[mod] : false;
    }
  }

  await sql`UPDATE organizations SET role_permissions = ${sql.json(cleaned)} WHERE id = ${orgId}`;
  res.json({ success: true });
}));

router.post('/roles', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Role name is required' }); return;
  }
  const roleName = name.trim().toLowerCase().replace(/\s+/g, '_');
  if (RESERVED_ROLE_NAMES.has(roleName)) {
    res.status(400).json({ error: 'Reserved role name' }); return;
  }

  const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const existing = org?.role_permissions || {};
  if (existing[roleName]) {
    res.status(409).json({ error: 'Role already exists' }); return;
  }

  const validModules = ['dashboard','repositories','files','search','knowledge','testData','approvals','archive','audit','users','settings','orgSettings'];
  const newRolePerms: Record<string, boolean> = {};
  for (const mod of validModules) newRolePerms[mod] = false;

  const updated = { ...existing, [roleName]: newRolePerms };
  await sql`UPDATE organizations SET role_permissions = ${sql.json(updated)} WHERE id = ${orgId}`;
  res.json({ role: roleName, permissions: newRolePerms });
}));

router.delete('/roles/:roleName', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { roleName } = req.params;
  if (roleName === 'admin') {
    res.status(400).json({ error: 'Cannot delete admin role' }); return;
  }

  const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const existing = { ...(org?.role_permissions || {}) };
  delete existing[roleName];
  await sql`UPDATE organizations SET role_permissions = ${sql.json(existing)} WHERE id = ${orgId}`;
  await sql`UPDATE users SET role = 'viewer' WHERE role = ${roleName} AND organization_id = ${orgId}`;
  res.json({ success: true });
}));

// GET/PUT retention policy
router.get('/retention', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const [org] = await sql`SELECT retention_days FROM organizations WHERE id = ${req.user!.organizationId}`;
  res.json({ retention_days: org?.retention_days ?? null });
}));

router.put('/retention', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { retention_days } = req.body;
  if (retention_days !== null && retention_days !== undefined) {
    const days = parseInt(retention_days);
    if (isNaN(days) || days < 1 || days > 3650) {
      res.status(400).json({ error: 'retention_days must be between 1 and 3650 (10 years), or null to disable' }); return;
    }
    await sql`UPDATE organizations SET retention_days = ${days} WHERE id = ${req.user!.organizationId}`;
    res.json({ retention_days: days });
  } else {
    await sql`UPDATE organizations SET retention_days = NULL WHERE id = ${req.user!.organizationId}`;
    res.json({ retention_days: null });
  }
}));

export default router;
