import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const repos = db.prepare(`
    SELECT r.*, u.name as owner_name,
      (SELECT COUNT(*) FROM files f WHERE f.repository_id = r.id AND f.status != 'archived') as file_count
    FROM repositories r
    LEFT JOIN users u ON r.owner_id = u.id
    ORDER BY r.parent_id NULLS FIRST, r.name
  `).all();
  res.json(repos);
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(req.params.id);
  if (!repo) { res.status(404).json({ error: 'Not found' }); return; }
  const files = db.prepare(`
    SELECT f.*, u.name as owner_name FROM files f
    LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.repository_id = ? AND f.status != 'archived'
    ORDER BY f.updated_at DESC
  `).all(req.params.id);
  const children = db.prepare('SELECT * FROM repositories WHERE parent_id = ? ORDER BY name').all(req.params.id);
  res.json({ ...repo as object, files, children });
});

router.post('/', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  const { name, description, parent_id, type, project } = req.body;
  const result = db.prepare('INSERT INTO repositories (name, description, parent_id, type, project, owner_id) VALUES (?, ?, ?, ?, ?, ?)').run(name, description || '', parent_id || null, type || 'folder', project || '', req.user!.userId);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id FROM repositories WHERE id=?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, description } = req.body;
  db.prepare('UPDATE repositories SET name=?, description=? WHERE id=?').run(name, description, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id FROM repositories WHERE id=?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  // Recursively collect all repo IDs (this folder + all descendants)
  const collectIds = (id: number): number[] => {
    const children = db.prepare('SELECT id FROM repositories WHERE parent_id = ?').all(id) as { id: number }[];
    return [id, ...children.flatMap(c => collectIds(c.id))];
  };
  const ids = collectIds(Number(req.params.id));
  const placeholders = ids.map(() => '?').join(',');

  db.transaction(() => {
    // Unlink files from these repos (keep the files, just disassociate)
    db.prepare(`UPDATE files SET repository_id = NULL WHERE repository_id IN (${placeholders})`).run(...ids);
    // Delete all descendant repos first, then the target
    db.prepare(`DELETE FROM repositories WHERE id IN (${placeholders})`).run(...ids);
  })();

  res.json({ message: 'Deleted' });
});

export default router;
