import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { sendApprovalNotification, sendUploadNotification } from '../mailer';
import { notificationQueue } from '../queue';

const router = Router();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => { cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`); },
});
const upload = multer({
  storage, limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const BLOCKED = ['text/html','application/x-httpd-php','application/x-sh','text/javascript','application/javascript','image/svg+xml','image/svg'];
    BLOCKED.includes(file.mimetype) ? cb(new Error('File type not allowed')) : cb(null, true);
  },
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { repository_id, status, project, category, search } = req.query;
  const isLead = ['admin','lead'].includes(req.user!.role);
  const rows = await sql`
    SELECT f.*, u.name as owner_name, r.name as repository_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE 1=1
    ${!isLead ? sql`AND (f.owner_id = ${req.user!.userId} OR f.status IN ('published','approved'))` : sql``}
    ${repository_id ? sql`AND f.repository_id = ${repository_id as string}` : sql``}
    ${status ? sql`AND f.status = ${status as string}` : sql``}
    ${project ? sql`AND f.project = ${project as string}` : sql``}
    ${category ? sql`AND f.category = ${category as string}` : sql``}
    ${search ? sql`AND (f.name ILIKE ${'%'+search+'%'} OR f.description ILIKE ${'%'+search+'%'} OR f.tags ILIKE ${'%'+search+'%'} OR f.jira_ticket ILIKE ${'%'+search+'%'})` : sql``}
    ORDER BY f.updated_at DESC
  `;
  res.json(rows);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const [file] = await sql`
    SELECT f.*, u.name as owner_name, r.name as repository_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.id = ${req.params.id}
  `;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const versions = await sql`SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ${req.params.id} ORDER BY fv.version DESC`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'VIEW', 'file', ${req.params.id}, ${`Viewed file id=${req.params.id}`}, ${req.ip || ''})`;
  res.json({ ...file, versions });
});

router.get('/:id/versions', authenticate, async (req: Request, res: Response) => {
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const versions = await sql`SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ${req.params.id} ORDER BY fv.version DESC`;
  res.json(versions);
});

router.post('/upload', authenticate, requireRole('admin', 'lead', 'engineer'), upload.single('file'), async (req: Request, res: Response) => {
  const { repository_id, project, module, category, jira_ticket, tags, description, version, change_log } = req.body;
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No file attached' }); return; }
  const name = req.body.name || f.originalname.replace(/\.[^/.]+$/, '');

  const [existing] = await sql`SELECT * FROM files WHERE name = ${name} AND repository_id = ${repository_id || null} AND status != 'archived'`;
  let fileId: number;
  let newVersion: number;

  if (existing) {
    newVersion = existing.version + 1;
    await sql`UPDATE files SET version=${newVersion}, path=${f.filename}, size=${f.size}, mime_type=${f.mimetype}, jira_ticket=${jira_ticket || existing.jira_ticket}, tags=${tags || existing.tags}, description=${description || existing.description}, status='draft', updated_at=NOW() WHERE id=${existing.id}`;
    fileId = existing.id;
  } else {
    newVersion = parseInt(version) || 1;
    const [{ id }] = await sql`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category, jira_ticket, tags, description)
      VALUES (${name}, ${f.originalname}, ${f.filename}, ${f.size}, ${f.mimetype}, ${repository_id || null}, ${req.user!.userId}, ${newVersion}, 'draft', ${project || ''}, ${module || ''}, ${category || ''}, ${jira_ticket || ''}, ${tags || ''}, ${description || ''})
      RETURNING id
    `;
    fileId = id;
  }

  await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by) VALUES (${fileId}, ${newVersion}, ${f.filename}, ${f.size}, ${change_log || (existing ? `Version ${newVersion} update` : 'Initial upload')}, ${req.user!.userId})`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Uploaded: ${f.originalname}`}, ${req.ip || ''})`;
  res.json({ id: fileId, version: newVersion, message: existing ? `New version ${newVersion} created` : 'File uploaded successfully' });
});

router.post('/bulk-upload', authenticate, requireRole('admin', 'lead', 'engineer'), upload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: 'No files attached' }); return; }
  const { repository_id, project, module, category } = req.body;
  const [repo] = await sql`SELECT id FROM repositories WHERE id = ${repository_id as string}`;
  if (!repo) { res.status(400).json({ error: 'Invalid repository' }); return; }

  const results = [];
  for (const f of files) {
    const name = f.originalname.replace(/\.[^/.]+$/, '');
    const [{ id: fileId }] = await sql`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category)
      VALUES (${name}, ${f.originalname}, ${f.filename}, ${f.size}, ${f.mimetype}, ${repository_id as string}, ${req.user!.userId}, 1, 'draft', ${project || ''}, ${module || ''}, ${category || ''})
      RETURNING id
    `;
    await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by) VALUES (${fileId}, 1, ${f.filename}, ${f.size}, 'Initial upload', ${req.user!.userId})`;
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Bulk uploaded: ${f.originalname}`}, ${req.ip || ''})`;
    results.push({ id: fileId, name, originalName: f.originalname, size: f.size });
  }
  res.json({ uploaded: results.length, files: results });
});

router.put('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name, project, module, category, jira_ticket, tags, description } = req.body;
  if (req.user!.role === 'engineer') {
    const [file] = await sql`SELECT owner_id FROM files WHERE id = ${req.params.id}`;
    if (!file || file.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  }
  await sql`UPDATE files SET name=${name}, project=${project as string}, module=${module}, category=${category as string}, jira_ticket=${jira_ticket}, tags=${tags}, description=${description}, updated_at=NOW() WHERE id=${req.params.id}`;
  res.json({ message: 'Updated' });
});

router.post('/:id/submit', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  if (req.user!.role === 'engineer') {
    const [file] = await sql`SELECT owner_id FROM files WHERE id = ${req.params.id}`;
    if (!file || file.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  }
  await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id=${req.params.id}`;
  const [file] = await sql`SELECT f.name, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=${req.params.id}`;
  const leads = await sql`SELECT id, name, email FROM users WHERE role IN ('admin','lead') AND active = TRUE`;
  for (const lead of leads) {
    await notificationQueue.add('notify', { userId: lead.id, type: 'approval', title: 'Review Requested', message: `"${file?.name}" submitted for review` });
    try { await sendUploadNotification(lead.email, lead.name, file?.owner_name, file?.name); } catch {}
  }
  res.json({ message: 'Submitted for review' });
});

router.post('/:id/approve', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const { status, comments } = req.body;
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['submitted'], submitted: ['under_review','approved','draft'],
    under_review: ['approved','draft'], approved: ['under_review','draft','published'],
    published: ['archived','draft'],
  };
  const [cur] = await sql`SELECT status FROM files WHERE id = ${req.params.id}`;
  if (!cur) { res.status(404).json({ error: 'Not found' }); return; }
  if (!VALID_TRANSITIONS[cur.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot transition from '${cur.status}' to '${status as string}'` }); return;
  }
  await sql`UPDATE files SET status=${status as string}, updated_at=NOW() WHERE id=${req.params.id}`;
  await sql`INSERT INTO approvals (file_id, reviewer_id, status, comments) VALUES (${req.params.id}, ${req.user!.userId}, ${status as string}, ${comments || ''})`;
  const [file] = await sql`SELECT f.name, f.owner_id, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=${req.params.id}`;
  if (file) {
    await notificationQueue.add('notify', { userId: file.owner_id, type: 'approval', title: `File ${status === 'approved' ? 'Approved' : 'Status Updated'}`, message: `Your file "${file.name}" is now: ${status as string}` });
    try { await sendApprovalNotification(file.owner_email, file.owner_name, file.name, status); } catch {}
  }
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'APPROVE', 'file', ${req.params.id}, ${`Changed status to ${status as string}`}, ${req.ip || ''})`;
  res.json({ message: 'Status updated' });
});

router.post('/:id/archive', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const [file] = await sql`SELECT status FROM files WHERE id = ${req.params.id}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (file.status === 'archived') { res.status(400).json({ error: 'File is already archived' }); return; }
  await sql`UPDATE files SET status='archived', updated_at=NOW() WHERE id=${req.params.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'ARCHIVE', 'file', ${req.params.id}, 'Archived file', ${req.ip || ''})`;
  res.json({ message: 'Archived' });
});

router.post('/:id/restore', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const [file] = await sql`SELECT status FROM files WHERE id = ${req.params.id}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (file.status !== 'archived') { res.status(400).json({ error: 'Only archived files can be restored' }); return; }
  await sql`UPDATE files SET status='draft', updated_at=NOW() WHERE id=${req.params.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'RESTORE', 'file', ${req.params.id}, 'Restored file from archive', ${req.ip || ''})`;
  res.json({ message: 'Restored to draft' });
});

router.delete('/:id', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const [file] = await sql`SELECT path FROM files WHERE id = ${req.params.id}`;
  if (file?.path) { const fp = path.join(UPLOAD_DIR, file.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
  await sql.begin(async tx => {
    await tx`DELETE FROM file_versions WHERE file_id = ${req.params.id}`;
    await tx`DELETE FROM approvals WHERE file_id = ${req.params.id}`;
    await tx`DELETE FROM files WHERE id = ${req.params.id}`;
  });
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'DELETE', 'file', ${req.params.id}, 'Permanently deleted file', ${req.ip || ''})`;
  res.json({ message: 'Deleted' });
});

router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'DOWNLOAD', 'file', ${req.params.id}, ${`Downloaded: ${file.original_name}`}, ${req.ip || ''})`;
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
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id}`;
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
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id}`;
  const [ver] = await sql`SELECT * FROM file_versions WHERE file_id = ${req.params.id} AND version = ${req.params.version}`;
  if (!file || !ver) { res.status(404).json({ error: 'Not found' }); return; }
  const filePath = path.join(UPLOAD_DIR, ver.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'Version file not found on disk.' });
  }
});

router.use((err: any, _req: Request, res: Response, next: Function) => {
  if (err?.code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'File too large (max 50 MB)' }); return; }
  if (err?.message) { res.status(400).json({ error: err.message }); return; }
  next(err);
});

export default router;
