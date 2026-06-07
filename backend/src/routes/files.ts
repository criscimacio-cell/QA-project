import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { sendApprovalNotification, sendUploadNotification } from '../mailer';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

router.get('/', authenticate, (req: Request, res: Response) => {
  const { repository_id, status, project, category, search } = req.query;
  let query = `
    SELECT f.*, u.name as owner_name, r.name as repository_name
    FROM files f
    LEFT JOIN users u ON f.owner_id = u.id
    LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (repository_id) { query += ' AND f.repository_id = ?'; params.push(repository_id); }
  if (status) { query += ' AND f.status = ?'; params.push(status); }
  if (project) { query += ' AND f.project = ?'; params.push(project); }
  if (category) { query += ' AND f.category = ?'; params.push(category); }
  if (search) { query += ' AND (f.name LIKE ? OR f.description LIKE ? OR f.tags LIKE ? OR f.jira_ticket LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s); }
  query += ' ORDER BY f.updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const file = db.prepare(`
    SELECT f.*, u.name as owner_name, r.name as repository_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const versions = db.prepare('SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ? ORDER BY fv.version DESC').all(req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'VIEW', 'file', ?, ?, ?)").run(req.user!.userId, req.params.id, `Viewed file id=${req.params.id}`, req.ip || '');
  res.json({ ...file as object, versions });
});

// Single upload
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  const { repository_id, project, module, category, jira_ticket, tags, description, version, change_log } = req.body;
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No file attached' }); return; }

  const name = req.body.name || f.originalname.replace(/\.[^/.]+$/, '');

  // Check if a file with same name exists in same repo — if so, create a new version
  const existing = db.prepare('SELECT * FROM files WHERE name = ? AND repository_id = ? AND status != ?').get(name, repository_id, 'archived') as any;
  let fileId: number;
  let newVersion: number;

  if (existing) {
    newVersion = existing.version + 1;
    db.prepare(`UPDATE files SET version=?, path=?, size=?, mime_type=?, jira_ticket=?, tags=?, description=?, status='draft', updated_at=datetime('now') WHERE id=?`)
      .run(newVersion, f.filename, f.size, f.mimetype, jira_ticket || existing.jira_ticket, tags || existing.tags, description || existing.description, existing.id);
    fileId = existing.id;
  } else {
    newVersion = parseInt(version) || 1;
    const result = db.prepare(`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category, jira_ticket, tags, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
    `).run(name, f.originalname, f.filename, f.size, f.mimetype, repository_id, req.user!.userId, newVersion, project || '', module || '', category || '', jira_ticket || '', tags || '', description || '');
    fileId = result.lastInsertRowid as number;
  }

  db.prepare('INSERT INTO file_versions (file_id, version, path, size, change_log, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(fileId, newVersion, f.filename, f.size, change_log || (existing ? `Version ${newVersion} update` : 'Initial upload'), req.user!.userId);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'UPLOAD', 'file', ?, ?, ?)").run(req.user!.userId, fileId, `Uploaded: ${f.originalname}`, req.ip || '');

  res.json({ id: fileId, version: newVersion, message: existing ? `New version ${newVersion} created` : 'File uploaded successfully' });
});

// Bulk upload
router.post('/bulk-upload', authenticate, upload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: 'No files attached' }); return; }

  const { repository_id, project, module, category } = req.body;
  const results = [];

  for (const f of files) {
    const name = f.originalname.replace(/\.[^/.]+$/, '');
    const result = db.prepare(`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?, ?)
    `).run(name, f.originalname, f.filename, f.size, f.mimetype, repository_id, req.user!.userId, project || '', module || '', category || '');
    const fileId = result.lastInsertRowid as number;
    db.prepare('INSERT INTO file_versions (file_id, version, path, size, change_log, created_by) VALUES (?, 1, ?, ?, ?, ?)').run(fileId, f.filename, f.size, 'Initial upload', req.user!.userId);
    db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'UPLOAD', 'file', ?, ?, ?)").run(req.user!.userId, fileId, `Bulk uploaded: ${f.originalname}`, req.ip || '');
    results.push({ id: fileId, name, originalName: f.originalname, size: f.size });
  }

  res.json({ uploaded: results.length, files: results });
});

router.put('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), (req: Request, res: Response) => {
  const { name, project, module, category, jira_ticket, tags, description } = req.body;
  db.prepare("UPDATE files SET name=?, project=?, module=?, category=?, jira_ticket=?, tags=?, description=?, updated_at=datetime('now') WHERE id=?").run(name, project, module, category, jira_ticket, tags, description, req.params.id);
  res.json({ message: 'Updated' });
});

router.post('/:id/submit', authenticate, async (req: Request, res: Response) => {
  db.prepare("UPDATE files SET status='submitted', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  const file = db.prepare('SELECT f.name, u.name as owner_name FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=?').get(req.params.id) as any;

  const leads = db.prepare("SELECT id, name, email FROM users WHERE role IN ('admin','lead') AND active=1").all() as any[];
  for (const lead of leads) {
    db.prepare("INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'approval', 'Review Requested', ?)").run(lead.id, `"${file?.name}" submitted for review`);
    try { await sendUploadNotification(lead.email, lead.name, file?.owner_name, file?.name); } catch {}
  }
  res.json({ message: 'Submitted for review' });
});

router.post('/:id/approve', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const { status, comments } = req.body;
  const validStatuses = ['under_review', 'approved', 'published', 'draft'];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }

  db.prepare("UPDATE files SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  db.prepare('INSERT INTO approvals (file_id, reviewer_id, status, comments) VALUES (?, ?, ?, ?)').run(req.params.id, req.user!.userId, status, comments || '');

  const file = db.prepare('SELECT f.name, f.owner_id, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=?').get(req.params.id) as any;
  if (file) {
    db.prepare("INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'approval', ?, ?)").run(file.owner_id, `File ${status === 'approved' ? 'Approved' : 'Status Updated'}`, `Your file "${file.name}" is now: ${status}`);
    try { await sendApprovalNotification(file.owner_email, file.owner_name, file.name, status); } catch {}
  }
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'APPROVE', 'file', ?, ?, ?)").run(req.user!.userId, req.params.id, `Changed status to ${status}`, req.ip || '');
  res.json({ message: 'Status updated' });
});

router.post('/:id/archive', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  db.prepare("UPDATE files SET status='archived', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'ARCHIVE', 'file', ?, 'Archived file', ?)").run(req.user!.userId, req.params.id, req.ip || '');
  res.json({ message: 'Archived' });
});

// Restore archived file
router.post('/:id/restore', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  db.prepare("UPDATE files SET status='draft', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'RESTORE', 'file', ?, 'Restored file from archive', ?)").run(req.user!.userId, req.params.id, req.ip || '');
  res.json({ message: 'Restored to draft' });
});

router.delete('/:id', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  const file = db.prepare('SELECT path FROM files WHERE id=?').get(req.params.id) as any;
  if (file?.path) {
    const filePath = path.join(UPLOAD_DIR, file.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("DELETE FROM file_versions WHERE file_id=?").run(req.params.id);
  db.prepare("DELETE FROM approvals WHERE file_id=?").run(req.params.id);
  db.prepare("DELETE FROM files WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'DELETE', 'file', ?, 'Permanently deleted file', ?)").run(req.user!.userId, req.params.id, req.ip || '');
  res.json({ message: 'Deleted' });
});

// Download (as attachment)
router.get('/:id/download', authenticate, (req: Request, res: Response) => {
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id) as any;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'DOWNLOAD', 'file', ?, ?, ?)").run(req.user!.userId, req.params.id, `Downloaded: ${file.original_name}`, req.ip || '');
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'File not found on disk. This may be a demo record with no physical file.' });
  }
});

// Preview (inline — for images and PDFs)
router.get('/:id/preview', authenticate, (req: Request, res: Response) => {
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id) as any;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'No preview available for demo records.' });
  }
});

// Download specific version
router.get('/:id/versions/:version/download', authenticate, (req: Request, res: Response) => {
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id) as any;
  const ver = db.prepare('SELECT * FROM file_versions WHERE file_id=? AND version=?').get(req.params.id, req.params.version) as any;
  if (!file || !ver) { res.status(404).json({ error: 'Not found' }); return; }
  const filePath = path.join(UPLOAD_DIR, ver.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'Version file not found on disk.' });
  }
});

export default router;
