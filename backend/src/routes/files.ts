import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const uploadDir = path.join(__dirname, '../../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

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

router.post('/upload', authenticate, upload.single('file'), (req: Request, res: Response) => {
  const { repository_id, project, module, category, jira_ticket, tags, description, version } = req.body;
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No file' }); return; }
  const name = req.body.name || f.originalname.replace(/\.[^/.]+$/, '');
  const result = db.prepare(`
    INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category, jira_ticket, tags, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
  `).run(name, f.originalname, f.filename, f.size, f.mimetype, repository_id, req.user!.userId, version || 1, project || '', module || '', category || '', jira_ticket || '', tags || '', description || '');
  db.prepare('INSERT INTO file_versions (file_id, version, path, size, change_log, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(result.lastInsertRowid, version || 1, f.filename, f.size, 'Initial upload', req.user!.userId);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'UPLOAD', 'file', ?, ?, ?)").run(req.user!.userId, result.lastInsertRowid, `Uploaded: ${f.originalname}`, req.ip || '');
  res.json({ id: result.lastInsertRowid, message: 'File uploaded' });
});

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { name, project, module, category, jira_ticket, tags, description } = req.body;
  db.prepare("UPDATE files SET name=?, project=?, module=?, category=?, jira_ticket=?, tags=?, description=?, updated_at=datetime('now') WHERE id=?").run(name, project, module, category, jira_ticket, tags, description, req.params.id);
  res.json({ message: 'Updated' });
});

router.post('/:id/submit', authenticate, (req: Request, res: Response) => {
  db.prepare("UPDATE files SET status='submitted', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  const file = db.prepare('SELECT name FROM files WHERE id=?').get(req.params.id) as any;
  db.prepare("INSERT INTO notifications (user_id, type, title, message) SELECT id, 'approval', 'Review Requested', ? FROM users WHERE role IN ('admin','lead')").run(`File "${file?.name}" submitted for review`);
  res.json({ message: 'Submitted for review' });
});

router.post('/:id/approve', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  const { status, comments } = req.body;
  const validStatuses = ['under_review', 'approved', 'published', 'draft'];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
  db.prepare("UPDATE files SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  db.prepare('INSERT INTO approvals (file_id, reviewer_id, status, comments) VALUES (?, ?, ?, ?)').run(req.params.id, req.user!.userId, status, comments || '');
  const file = db.prepare('SELECT name, owner_id FROM files WHERE id=?').get(req.params.id) as any;
  if (file) db.prepare("INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'approval', ?, ?)").run(file.owner_id, `File ${status === 'approved' ? 'Approved' : 'Status Updated'}`, `Your file "${file.name}" status is now: ${status}`);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'APPROVE', 'file', ?, ?, ?)").run(req.user!.userId, req.params.id, `Changed status to ${status}`, req.ip || '');
  res.json({ message: 'Status updated' });
});

router.post('/:id/archive', authenticate, (req: Request, res: Response) => {
  db.prepare("UPDATE files SET status='archived', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'ARCHIVE', 'file', ?, 'Archived file', ?)").run(req.user!.userId, req.params.id, req.ip || '');
  res.json({ message: 'Archived' });
});

router.delete('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), (req: Request, res: Response) => {
  db.prepare("UPDATE files SET status='archived' WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'DELETE', 'file', ?, 'Deleted file', ?)").run(req.user!.userId, req.params.id, req.ip || '');
  res.json({ message: 'Deleted' });
});

router.get('/:id/download', authenticate, (req: Request, res: Response) => {
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id) as any;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'DOWNLOAD', 'file', ?, ?, ?)").run(req.user!.userId, req.params.id, `Downloaded: ${file.original_name}`, req.ip || '');
  const filePath = path.join(uploadDir, file.path);
  if (fs.existsSync(filePath)) {
    res.download(filePath, file.original_name);
  } else {
    res.status(404).json({ error: 'File not on disk (demo mode)' });
  }
});

export default router;
