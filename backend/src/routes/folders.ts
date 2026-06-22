import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole, requireModule } from '../middleware/auth';

const router = Router();

// GET /api/folders — list all folders for the org
router.get('/', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const folders = await sql`
    SELECT f.id, f.name, f.parent_id, f.created_at, f.created_by, u.name as created_by_name
    FROM file_folders f LEFT JOIN users u ON f.created_by = u.id
    WHERE f.organization_id = ${orgId}
    ORDER BY f.name ASC
  `;
  res.json(folders);
});

// POST /api/folders — create folder
router.post('/', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name, parent_id } = req.body;
  const orgId = req.user!.organizationId;
  if (!name?.trim()) { res.status(400).json({ error: 'Folder name is required' }); return; }

  // If parent_id given, verify it belongs to same org
  if (parent_id) {
    const [parent] = await sql`SELECT id FROM file_folders WHERE id = ${parent_id} AND organization_id = ${orgId}`;
    if (!parent) { res.status(400).json({ error: 'Parent folder not found' }); return; }
  }

  const [folder] = await sql`
    INSERT INTO file_folders (name, parent_id, organization_id, created_by)
    VALUES (${name.trim()}, ${parent_id || null}, ${orgId}, ${req.user!.userId})
    RETURNING id, name, parent_id, created_at
  `;
  res.status(201).json(folder);
});

// PUT /api/folders/:id — rename folder
router.put('/:id', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name } = req.body;
  const orgId = req.user!.organizationId;
  if (!name?.trim()) { res.status(400).json({ error: 'Folder name is required' }); return; }

  const [folder] = await sql`SELECT id, created_by FROM file_folders WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!folder) { res.status(404).json({ error: 'Folder not found' }); return; }

  // Engineers can only rename their own folders
  if (req.user!.role === 'engineer' && folder.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden: you can only rename your own folders' }); return;
  }

  const [updated] = await sql`
    UPDATE file_folders SET name = ${name.trim()}, updated_at = NOW()
    WHERE id = ${req.params.id} AND organization_id = ${orgId}
    RETURNING id, name, parent_id, updated_at
  `;
  res.json(updated);
});

// DELETE /api/folders/:id — delete (admin/lead only; reject if non-empty)
router.delete('/:id', authenticate, requireModule('files'), requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [folder] = await sql`SELECT id FROM file_folders WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!folder) { res.status(404).json({ error: 'Folder not found' }); return; }

  // Check for files inside
  const [{ count: fileCount }] = await sql`SELECT COUNT(*)::int as count FROM files WHERE folder_id = ${req.params.id} AND organization_id = ${orgId} AND status != 'archived'` as any[];
  if (fileCount > 0) { res.status(409).json({ error: `Cannot delete: folder contains ${fileCount} file(s). Move or archive them first.` }); return; }

  // Check for sub-folders
  const [{ count: subCount }] = await sql`SELECT COUNT(*)::int as count FROM file_folders WHERE parent_id = ${req.params.id} AND organization_id = ${orgId}` as any[];
  if (subCount > 0) { res.status(409).json({ error: `Cannot delete: folder contains ${subCount} sub-folder(s). Delete them first.` }); return; }

  await sql`DELETE FROM file_folders WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  res.json({ message: 'Folder deleted' });
});

export default router;
