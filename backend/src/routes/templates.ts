import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import sql from '../db';
import { authenticate, requireRole, requireModule } from '../middleware/auth';

const router = Router();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const TEMPLATE_DIR = path.join(UPLOAD_DIR, 'templates');

// GET /api/templates
router.get('/', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const templates = await sql`
    SELECT t.id, t.name, t.description, t.mime_type, t.size, t.category, t.tags,
           t.created_at, t.source_file_id, u.name as created_by_name
    FROM file_templates t LEFT JOIN users u ON t.created_by = u.id
    WHERE t.organization_id = ${orgId}
    ORDER BY t.created_at DESC
  `;
  res.json(templates);
});

// POST /api/templates — save file as template
router.post('/', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { file_id, name, description } = req.body;
  const orgId = req.user!.organizationId;
  if (!file_id || !name?.trim()) { res.status(400).json({ error: 'file_id and name are required' }); return; }

  const [file] = await sql`SELECT * FROM files WHERE id = ${file_id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }

  const srcPath = path.join(UPLOAD_DIR, file.path);
  if (!fs.existsSync(srcPath)) { res.status(400).json({ error: 'Source file not found on disk' }); return; }

  // Copy encrypted file to templates directory
  const templateFilename = `${Date.now()}-${path.basename(file.path)}`;
  const destPath = path.join(TEMPLATE_DIR, templateFilename);
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  fs.copyFileSync(srcPath, destPath);

  const [tmpl] = await sql`
    INSERT INTO file_templates (name, description, source_file_id, path, mime_type, size, category, tags, created_by, organization_id)
    VALUES (${name.trim()}, ${description || ''}, ${file_id}, ${`templates/${templateFilename}`}, ${file.mime_type}, ${file.size}, ${file.category || ''}, ${file.tags || ''}, ${req.user!.userId}, ${orgId})
    RETURNING id, name, description, mime_type, size, category, created_at
  `;
  res.status(201).json(tmpl);
});

// POST /api/templates/:id/create-file — create a new file from template
router.post('/:id/create-file', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name, folder_id, repository_id, project, category, description } = req.body;
  const orgId = req.user!.organizationId;
  if (!name?.trim()) { res.status(400).json({ error: 'File name is required' }); return; }

  const [tmpl] = await sql`SELECT * FROM file_templates WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!tmpl) { res.status(404).json({ error: 'Template not found' }); return; }

  const srcPath = path.join(UPLOAD_DIR, tmpl.path);
  if (!fs.existsSync(srcPath)) { res.status(400).json({ error: 'Template file not found on disk' }); return; }

  // Copy encrypted template to uploads
  const newFilename = `${Date.now()}-${path.basename(tmpl.path)}`;
  const destPath = path.join(UPLOAD_DIR, newFilename);
  fs.copyFileSync(srcPath, destPath);

  const [{ id: fileId }] = await sql`
    INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, category, description, folder_id, organization_id)
    VALUES (${name.trim()}, ${name.trim()}, ${newFilename}, ${tmpl.size}, ${tmpl.mime_type}, ${repository_id || null}, ${req.user!.userId}, 1, 'draft', ${project || ''}, ${category || tmpl.category || ''}, ${description || `Created from template: ${tmpl.name}`}, ${folder_id || null}, ${orgId})
    RETURNING id
  `;
  await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by, organization_id) VALUES (${fileId}, 1, ${newFilename}, ${tmpl.size}, ${'Created from template: ' + tmpl.name}, ${req.user!.userId}, ${orgId})`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Created from template: ${tmpl.name}`}, ${req.ip || ''}, ${orgId})`;

  res.status(201).json({ id: fileId, message: 'File created from template' });
});

// DELETE /api/templates/:id
router.delete('/:id', authenticate, requireModule('files'), requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [tmpl] = await sql`SELECT * FROM file_templates WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!tmpl) { res.status(404).json({ error: 'Template not found' }); return; }

  const filePath = path.join(UPLOAD_DIR, tmpl.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await sql`DELETE FROM file_templates WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  res.json({ message: 'Template deleted' });
});

export default router;
