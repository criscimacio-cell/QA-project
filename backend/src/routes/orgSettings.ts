import { Router, Request, Response } from 'express';
import { authenticate, requireRole, RESERVED_ROLE_NAMES } from '../middleware/auth';
import sql from '../db';

const router = Router();

// Admin always has full access to everything - this never changes
export const ADMIN_PERMISSIONS: Record<string, boolean> = {
  dashboard: true, repositories: true, files: true, search: true,
  knowledge: true, testData: true, approvals: true, archive: true,
  audit: true, users: true, settings: true, orgSettings: true,
};

// GET /org-settings/permissions — any authenticated user (needed by frontend for sidebar canAccess)
router.get('/permissions', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const stored = org?.role_permissions || {};
  // Always include admin as non-configurable full access
  res.json({ admin: ADMIN_PERMISSIONS, ...stored });
});

// PUT /org-settings/permissions — save permissions for existing custom roles (admin only)
router.put('/permissions', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { permissions } = req.body;
  const validModules = ['dashboard','repositories','files','search','knowledge','testData','approvals','archive','audit','users','settings','orgSettings'];

  // Build cleaned config — never allow modifying admin
  const current = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const existing = current[0]?.role_permissions || {};

  const cleaned: Record<string, Record<string, boolean>> = {};
  // Preserve all existing custom role names
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
});

// POST /org-settings/roles — create a new custom role
router.post('/roles', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
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

  // New role starts with all modules off (admin configures what it can see)
  const validModules = ['dashboard','repositories','files','search','knowledge','testData','approvals','archive','audit','users','settings','orgSettings'];
  const newRolePerms: Record<string, boolean> = {};
  for (const mod of validModules) newRolePerms[mod] = false;

  const updated = { ...existing, [roleName]: newRolePerms };
  await sql`UPDATE organizations SET role_permissions = ${sql.json(updated)} WHERE id = ${orgId}`;
  res.json({ role: roleName, permissions: newRolePerms });
});

// DELETE /org-settings/roles/:roleName — delete a custom role
router.delete('/roles/:roleName', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { roleName } = req.params;
  if (roleName === 'admin') {
    res.status(400).json({ error: 'Cannot delete admin role' }); return;
  }

  const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const existing = { ...(org?.role_permissions || {}) };
  delete existing[roleName];
  await sql`UPDATE organizations SET role_permissions = ${sql.json(existing)} WHERE id = ${orgId}`;
  // Reassign users who held the deleted role to 'viewer' so their tokens no longer pass custom-role checks
  await sql`UPDATE users SET role = 'viewer' WHERE role = ${roleName} AND organization_id = ${orgId}`;
  res.json({ success: true });
});

export default router;
