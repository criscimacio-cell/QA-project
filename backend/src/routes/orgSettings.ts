import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import sql from '../db';

const router = Router();

// Default permissions — what each role can see by default
export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin:    { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: true, archive: true, audit: true, users: true, settings: true, orgSettings: true },
  lead:     { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: true, archive: true, audit: false, users: false, settings: true, orgSettings: false },
  engineer: { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: false, archive: false, audit: false, users: false, settings: true, orgSettings: false },
  viewer:   { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: false, archive: false, audit: false, users: false, settings: true, orgSettings: false },
};

// GET /org-settings/permissions — returns merged (default + custom) permissions
router.get('/permissions', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
  const custom = org?.role_permissions || {};

  // Merge custom over defaults per role
  const merged: Record<string, Record<string, boolean>> = {};
  for (const role of ['admin', 'lead', 'engineer', 'viewer']) {
    merged[role] = { ...DEFAULT_PERMISSIONS[role], ...(custom[role] || {}) };
  }
  res.json(merged);
});

// PUT /org-settings/permissions — admin only, save custom permissions
router.put('/permissions', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { permissions } = req.body;

  // Validate structure
  const validModules = ['dashboard', 'repositories', 'files', 'search', 'knowledge', 'testData', 'approvals', 'archive', 'audit', 'users', 'settings', 'orgSettings'];
  const validRoles = ['lead', 'engineer', 'viewer']; // admin always has full access, never configurable

  const cleaned: Record<string, Record<string, boolean>> = {};
  for (const role of validRoles) {
    if (permissions[role]) {
      cleaned[role] = {};
      for (const mod of validModules) {
        if (typeof permissions[role][mod] === 'boolean') {
          cleaned[role][mod] = permissions[role][mod];
        }
      }
    }
  }

  await sql`UPDATE organizations SET role_permissions = ${sql.json(cleaned)} WHERE id = ${orgId}`;
  res.json({ success: true });
});

export default router;
