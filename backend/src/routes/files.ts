import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as (format: string, opts?: object) => import('archiver').Archiver;
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { sendApprovalNotification, sendUploadNotification } from '../mailer';

const PLAN_STORAGE_LIMITS: Record<string, number> = {
  free: 1 * 1024 ** 3,        // 1 GB
  pro: 50 * 1024 ** 3,        // 50 GB
  enterprise: Infinity,
};
import { notificationQueue } from '../queue';

const router = Router();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => { cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`); },
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { repository_id, status, project, category, search } = req.query;
  const orgId = req.user!.organizationId;
  const isLead = ['admin','lead'].includes(req.user!.role);
  const rows = await sql`
    SELECT f.id, f.name, f.original_name, f.size, f.mime_type, f.status,
           f.project, f.module, f.category, f.jira_ticket, f.tags,
           f.description, f.version, f.created_at, f.updated_at,
           f.owner_id, f.repository_id,
           u.name as owner_name, r.name as repository_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.organization_id = ${orgId}
    ${!isLead ? sql`AND (f.owner_id = ${req.user!.userId} OR f.status IN ('published','approved'))` : sql``}
    ${repository_id ? sql`AND f.repository_id = ${repository_id as string}` : sql``}
    ${status ? sql`AND f.status = ${status as string}` : sql`AND f.status != 'archived'`}
    ${project ? sql`AND f.project = ${project as string}` : sql``}
    ${category ? sql`AND f.category = ${category as string}` : sql``}
    ${search ? sql`AND (f.name ILIKE ${'%'+search+'%'} OR f.description ILIKE ${'%'+search+'%'} OR f.tags ILIKE ${'%'+search+'%'} OR f.jira_ticket ILIKE ${'%'+search+'%'})` : sql``}
    ORDER BY f.updated_at DESC
  `;
  res.json(rows);
});

router.get('/export', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const files = await sql`
    SELECT f.id, f.name, f.original_name, f.version, f.status, f.project, f.module, f.category, f.jira_ticket, f.tags, f.size, u.name as owner, r.name as repository, f.created_at, f.updated_at
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.organization_id = ${orgId}
    ORDER BY f.updated_at DESC
  `;
  const header = 'ID,Name,Original Name,Version,Status,Project,Module,Category,Jira Ticket,Tags,Size (bytes),Owner,Repository,Created,Updated';
  const rows = files.map((f: any) =>
    [f.id, `"${f.name}"`, `"${f.original_name}"`, f.version, f.status, `"${f.project||''}"`, `"${f.module||''}"`, `"${f.category||''}"`, `"${f.jira_ticket||''}"`, `"${f.tags||''}"`, f.size, `"${f.owner||''}"`, `"${f.repository||''}"`, new Date(f.created_at).toISOString(), new Date(f.updated_at).toISOString()].join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="files-export-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send([header, ...rows].join('\n'));
});

router.post('/bulk-action', authenticate, requireRole('admin', 'lead', 'engineer'), async (req, res) => {
  const { ids, action } = req.body as { ids: number[]; action: 'archive' | 'delete' | 'submit' };
  if (!ids?.length || !action) { res.status(400).json({ error: 'ids and action required' }); return; }
  if (action === 'delete' && req.user!.role !== 'admin') { res.status(403).json({ error: 'Forbidden: only admins can bulk delete' }); return; }
  const role = req.user!.role;
  const userId = req.user!.userId;
  const orgId = req.user!.organizationId;

  if (action === 'archive') {
    if (role === 'engineer') {
      await sql`UPDATE files SET status='archived', updated_at=NOW() WHERE id = ANY(${ids}::int[]) AND status != 'archived' AND owner_id = ${userId} AND organization_id = ${orgId}`;
      await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) SELECT ${userId}, 'ARCHIVE', 'file', id, 'Bulk archived', ${req.ip || ''}, ${orgId} FROM files WHERE id = ANY(${ids}::int[]) AND owner_id = ${userId} AND organization_id = ${orgId}`;
    } else {
      await sql`UPDATE files SET status='archived', updated_at=NOW() WHERE id = ANY(${ids}::int[]) AND status != 'archived' AND organization_id = ${orgId}`;
      await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) SELECT ${userId}, 'ARCHIVE', 'file', id, 'Bulk archived', ${req.ip || ''}, ${orgId} FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}`;
    }
  } else if (action === 'submit') {
    if (role === 'engineer') {
      await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id = ANY(${ids}::int[]) AND status = 'draft' AND owner_id = ${userId} AND organization_id = ${orgId}`;
    } else {
      await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id = ANY(${ids}::int[]) AND status = 'draft' AND organization_id = ${orgId}`;
    }
  } else if (action === 'delete') {
    await sql.begin(async tx => {
      await tx`DELETE FROM file_comments WHERE file_id IN (SELECT id FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId})`;
      await tx`DELETE FROM file_versions WHERE file_id IN (SELECT id FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId})`;
      await tx`DELETE FROM approvals WHERE file_id IN (SELECT id FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId})`;
      await tx`DELETE FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}`;
    });
  }
  res.json({ message: `Bulk ${action} complete`, count: ids.length });
});

router.post('/bulk-download', authenticate, async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: number[] };
  if (!ids?.length) { res.status(400).json({ error: 'No file ids provided' }); return; }
  const orgId = req.user!.organizationId;
  const isLead = ['admin', 'lead'].includes(req.user!.role);
  const files = await sql`
    SELECT id, name, original_name, path, mime_type, owner_id, status
    FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}
  `;
  const allowed = files.filter((f: any) =>
    isLead || f.owner_id === req.user!.userId || ['published', 'approved'].includes(f.status)
  );
  if (!allowed.length) { res.status(403).json({ error: 'No accessible files in selection' }); return; }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="files-${new Date().toISOString().slice(0,10)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  const seen = new Map<string, number>();
  for (const f of allowed) {
    const filePath = path.join(UPLOAD_DIR, f.path);
    if (!fs.existsSync(filePath)) continue;
    const ext = path.extname(f.original_name);
    const base = path.basename(f.original_name, ext);
    const count = seen.get(f.original_name) || 0;
    seen.set(f.original_name, count + 1);
    const zipName = count === 0 ? f.original_name : `${base}_(${count})${ext}`;
    archive.file(filePath, { name: zipName });
  }
  await archive.finalize();
});

router.post('/bulk-submit', authenticate, requireRole('admin', 'lead', 'engineer'), async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!ids?.length) { res.status(400).json({ error: 'ids required' }); return; }
  const orgId = req.user!.organizationId;
  if (req.user!.role === 'engineer') {
    await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id = ANY(${ids}::int[]) AND status = 'draft' AND owner_id = ${req.user!.userId} AND organization_id = ${orgId}`;
  } else {
    await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id = ANY(${ids}::int[]) AND status = 'draft' AND organization_id = ${orgId}`;
  }
  res.json({ message: 'Submitted for review' });
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`
    SELECT f.id, f.name, f.original_name, f.size, f.mime_type, f.status,
           f.project, f.module, f.category, f.jira_ticket, f.tags,
           f.description, f.version, f.created_at, f.updated_at,
           f.owner_id, f.repository_id,
           u.name as owner_name, r.name as repository_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.id = ${req.params.id} AND f.organization_id = ${orgId}
  `;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const versions = await sql`SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ${req.params.id} AND fv.organization_id = ${orgId} ORDER BY fv.version DESC`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'VIEW', 'file', ${req.params.id}, ${`Viewed file id=${req.params.id}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ ...file, versions });
});

router.get('/:id/versions', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id, owner_id, status FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const versions = await sql`SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ${req.params.id} AND fv.organization_id = ${orgId} ORDER BY fv.version DESC`;
  res.json(versions);
});

router.post('/upload', authenticate, requireRole('admin', 'lead', 'engineer'), upload.single('file'), async (req: Request, res: Response) => {
  const { repository_id, project, module, category, jira_ticket, tags, description, version, change_log } = req.body;
  const orgId = req.user!.organizationId;
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No file attached' }); return; }
  const name = req.body.name || f.originalname.replace(/\.[^/.]+$/, '');

  // Enforce per-plan storage limits
  const [orgRow] = await sql`SELECT plan FROM organizations WHERE id = ${orgId}`;
  const storageLimit = PLAN_STORAGE_LIMITS[orgRow?.plan] ?? PLAN_STORAGE_LIMITS.free;
  const [{ used }] = await sql`SELECT COALESCE(SUM(size),0)::bigint as used FROM files WHERE organization_id = ${orgId}` as any[];
  if (Number(used) + f.size > storageLimit) {
    fs.unlinkSync(path.join(UPLOAD_DIR, f.filename));
    const limitGB = storageLimit === Infinity ? '∞' : (storageLimit / 1024 ** 3).toFixed(0);
    res.status(403).json({ error: `Storage limit reached (${limitGB}GB on ${orgRow?.plan} plan). Please upgrade or free up space.` }); return;
  }

  const [existing] = await sql`SELECT * FROM files WHERE name = ${name} AND repository_id = ${repository_id || null} AND status != 'archived' AND organization_id = ${orgId}`;
  let fileId: number;
  let newVersion: number;

  if (existing) {
    newVersion = existing.version + 1;
    await sql`UPDATE files SET version=${newVersion}, path=${f.filename}, size=${f.size}, mime_type=${f.mimetype}, jira_ticket=${jira_ticket || existing.jira_ticket}, tags=${tags || existing.tags}, description=${description || existing.description}, status='draft', updated_at=NOW() WHERE id=${existing.id} AND organization_id=${orgId}`;
    fileId = existing.id;
  } else {
    newVersion = parseInt(version) || 1;
    const [{ id }] = await sql`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category, jira_ticket, tags, description, organization_id)
      VALUES (${name}, ${f.originalname}, ${f.filename}, ${f.size}, ${f.mimetype}, ${repository_id || null}, ${req.user!.userId}, ${newVersion}, 'draft', ${project || ''}, ${module || ''}, ${category || ''}, ${jira_ticket || ''}, ${tags || ''}, ${description || ''}, ${orgId})
      RETURNING id
    `;
    fileId = id;
  }

  await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by, organization_id) VALUES (${fileId}, ${newVersion}, ${f.filename}, ${f.size}, ${change_log || (existing ? `Version ${newVersion} update` : 'Initial upload')}, ${req.user!.userId}, ${orgId})`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Uploaded: ${f.originalname}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ id: fileId, version: newVersion, message: existing ? `New version ${newVersion} created` : 'File uploaded successfully' });
});

router.post('/bulk-upload', authenticate, requireRole('admin', 'lead', 'engineer'), upload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: 'No files attached' }); return; }
  const { repository_id, project, module, category } = req.body;
  const orgId = req.user!.organizationId;
  const [repo] = await sql`SELECT id FROM repositories WHERE id = ${repository_id as string} AND organization_id = ${orgId}`;
  if (!repo) { res.status(400).json({ error: 'Invalid repository' }); return; }

  const results = [];
  for (const f of files) {
    const name = f.originalname.replace(/\.[^/.]+$/, '');
    const [{ id: fileId }] = await sql`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category, organization_id)
      VALUES (${name}, ${f.originalname}, ${f.filename}, ${f.size}, ${f.mimetype}, ${repository_id as string}, ${req.user!.userId}, 1, 'draft', ${project || ''}, ${module || ''}, ${category || ''}, ${orgId})
      RETURNING id
    `;
    await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by, organization_id) VALUES (${fileId}, 1, ${f.filename}, ${f.size}, 'Initial upload', ${req.user!.userId}, ${orgId})`;
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Bulk uploaded: ${f.originalname}`}, ${req.ip || ''}, ${orgId})`;
    results.push({ id: fileId, name, originalName: f.originalname, size: f.size });
  }
  res.json({ uploaded: results.length, files: results });
});

router.put('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name, project, module, category, jira_ticket, tags, description } = req.body;
  const orgId = req.user!.organizationId;
  if (req.user!.role === 'engineer') {
    const [file] = await sql`SELECT owner_id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
    if (!file || file.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  }
  await sql`UPDATE files SET name=${name}, project=${project as string}, module=${module}, category=${category as string}, jira_ticket=${jira_ticket}, tags=${tags}, description=${description}, updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  res.json({ message: 'Updated' });
});

router.post('/:id/submit', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  if (req.user!.role === 'engineer') {
    const [file] = await sql`SELECT owner_id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
    if (!file || file.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  }
  await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  const [file] = await sql`SELECT f.name, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=${req.params.id} AND f.organization_id=${orgId}`;
  const leads = await sql`SELECT id, name, email FROM users WHERE role IN ('admin','lead') AND active = TRUE AND organization_id = ${orgId}`;
  for (const lead of leads) {
    await notificationQueue.add('notify', { userId: lead.id, type: 'approval', title: 'Review Requested', message: `"${file?.name}" submitted for review`, organizationId: orgId });
    try { await sendUploadNotification(lead.email, lead.name, file?.owner_name, file?.name); } catch {}
  }
  res.json({ message: 'Submitted for review' });
});

router.post('/:id/approve', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const { status, comments } = req.body;
  const orgId = req.user!.organizationId;
  if (comments && typeof comments === 'string' && comments.length > 2000) {
    res.status(400).json({ error: 'Comment must be 2000 characters or fewer' }); return;
  }
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['submitted'], submitted: ['under_review','approved','draft'],
    under_review: ['approved','draft'], approved: ['under_review','draft','published'],
    published: ['archived','draft'],
  };
  const [cur] = await sql`SELECT status FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!cur) { res.status(404).json({ error: 'Not found' }); return; }
  if (!VALID_TRANSITIONS[cur.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot transition from '${cur.status}' to '${status as string}'` }); return;
  }
  await sql`UPDATE files SET status=${status as string}, updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO approvals (file_id, reviewer_id, status, comments, organization_id) VALUES (${req.params.id}, ${req.user!.userId}, ${status as string}, ${comments || ''}, ${orgId})`;
  const [file] = await sql`SELECT f.name, f.owner_id, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=${req.params.id} AND f.organization_id=${orgId}`;
  if (file) {
    await notificationQueue.add('notify', { userId: file.owner_id, type: 'approval', title: `File ${status === 'approved' ? 'Approved' : 'Status Updated'}`, message: `Your file "${file.name}" is now: ${status as string}`, organizationId: orgId });
    try { await sendApprovalNotification(file.owner_email, file.owner_name, file.name, status); } catch {}
  }
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'APPROVE', 'file', ${req.params.id}, ${`Changed status to ${status as string}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Status updated' });
});

router.post('/:id/archive', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT status, owner_id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.user!.role === 'engineer' && file.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden: engineers can only archive their own files' }); return; }
  if (file.status === 'archived') { res.status(400).json({ error: 'File is already archived' }); return; }
  await sql`UPDATE files SET status='archived', updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'ARCHIVE', 'file', ${req.params.id}, 'Archived file', ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Archived' });
});

router.post('/:id/restore', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT status FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (file.status !== 'archived') { res.status(400).json({ error: 'Only archived files can be restored' }); return; }
  await sql`UPDATE files SET status='draft', updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'RESTORE', 'file', ${req.params.id}, 'Restored file from archive', ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Restored to draft' });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT path FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (file?.path) { const fp = path.join(UPLOAD_DIR, file.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
  await sql.begin(async tx => {
    await tx`DELETE FROM file_versions WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
    await tx`DELETE FROM approvals WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
    await tx`DELETE FROM file_comments WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
    await tx`DELETE FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  });
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'DELETE', 'file', ${req.params.id}, 'Permanently deleted file', ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Deleted' });
});

router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'DOWNLOAD', 'file', ${req.params.id}, ${`Downloaded: ${file.original_name}`}, ${req.ip || ''}, ${orgId})`;
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'File not found on disk. This may be a demo record with no physical file.' });
  }
});

router.get('/:id/preview', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    const SAFE = new Set(['image/jpeg','image/png','image/gif','image/webp','image/bmp','application/pdf']);
    const mime = file.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', SAFE.has(mime) ? mime : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${SAFE.has(mime) ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.original_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'No preview available for demo records.' });
  }
});

router.get('/:id/versions/:version/download', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  const [ver] = await sql`SELECT * FROM file_versions WHERE file_id = ${req.params.id} AND version = ${req.params.version} AND organization_id = ${orgId}`;
  if (!file || !ver) { res.status(404).json({ error: 'Not found' }); return; }
  const isAdminOrLead = ['admin', 'lead'].includes(req.user!.role);
  if (!isAdminOrLead && file.status === 'draft' && file.owner_id !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const filePath = path.join(UPLOAD_DIR, ver.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'Version file not found on disk.' });
  }
});

router.get('/:id/comments', authenticate, async (req, res) => {
  const orgId = req.user!.organizationId;
  // Verify file belongs to org first
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const comments = await sql`
    SELECT fc.*, u.name as user_name, u.avatar as user_avatar
    FROM file_comments fc JOIN users u ON fc.user_id = u.id
    WHERE fc.file_id = ${req.params.id} AND fc.organization_id = ${orgId}
    ORDER BY fc.created_at ASC
  `;
  res.json(comments);
});

router.post('/:id/comments', authenticate, requireRole('admin', 'lead', 'engineer'), async (req, res) => {
  const { comment } = req.body;
  const orgId = req.user!.organizationId;
  if (!comment?.trim()) { res.status(400).json({ error: 'Comment cannot be empty' }); return; }
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const [row] = await sql`
    INSERT INTO file_comments (file_id, user_id, comment, organization_id)
    VALUES (${req.params.id}, ${req.user!.userId}, ${comment.trim()}, ${orgId})
    RETURNING id, created_at
  `;
  const [user] = await sql`SELECT name, avatar FROM users WHERE id = ${req.user!.userId} AND organization_id = ${orgId}`;
  res.json({ ...row, user_name: user.name, user_avatar: user.avatar, comment: comment.trim(), user_id: req.user!.userId, file_id: parseInt(req.params.id) });
});

router.delete('/:id/comments/:cid', authenticate, async (req, res) => {
  const orgId = req.user!.organizationId;
  const [c] = await sql`SELECT user_id FROM file_comments WHERE id = ${req.params.cid} AND file_id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!c) { res.status(404).json({ error: 'Not found' }); return; }
  if (c.user_id !== req.user!.userId && req.user!.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }
  await sql`DELETE FROM file_comments WHERE id = ${req.params.cid} AND organization_id = ${orgId}`;
  res.json({ message: 'Deleted' });
});

router.get('/:id/approvals', authenticate, async (req, res) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const history = await sql`
    SELECT a.*, u.name as reviewer_name, u.avatar as reviewer_avatar
    FROM approvals a JOIN users u ON a.reviewer_id = u.id
    WHERE a.file_id = ${req.params.id} AND a.organization_id = ${orgId}
    ORDER BY a.created_at DESC
  `;
  res.json(history);
});

router.use((err: any, _req: Request, res: Response, next: Function) => {
  if (err?.code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'File too large (max 50 MB)' }); return; }
  if (err?.message) { res.status(400).json({ error: err.message }); return; }
  next(err);
});

export default router;
