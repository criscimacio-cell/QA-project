import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/categories/list', authenticate, (req: Request, res: Response) => {
  const cats = db.prepare("SELECT name, COUNT(ka.id) as count FROM categories LEFT JOIN knowledge_articles ka ON ka.category = categories.name WHERE categories.type = 'knowledge' GROUP BY categories.name ORDER BY categories.name").all();
  res.json(cats);
});

router.get('/', authenticate, (req: Request, res: Response) => {
  const { category, status, search } = req.query;
  let query = `SELECT k.*, u.name as author_name FROM knowledge_articles k LEFT JOIN users u ON k.author_id = u.id WHERE 1=1`;
  const params: any[] = [];
  if (category) { query += ' AND k.category = ?'; params.push(category); }
  if (status) { query += ' AND k.status = ?'; params.push(status); }
  if (search) { query += ' AND (k.title LIKE ? OR k.content LIKE ? OR k.tags LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
  query += ' ORDER BY k.updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const article = db.prepare('SELECT k.*, u.name as author_name FROM knowledge_articles k LEFT JOIN users u ON k.author_id = u.id WHERE k.id = ?').get(req.params.id);
  if (!article) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(article);
});

router.post('/', authenticate, (req: Request, res: Response) => {
  const { title, content, category, tags } = req.body;
  const result = db.prepare('INSERT INTO knowledge_articles (title, content, category, author_id, status, tags) VALUES (?, ?, ?, ?, ?, ?)').run(title, content || '', category || '', req.user!.userId, 'draft', tags || '');
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { title, content, category, tags, status } = req.body;
  db.prepare("UPDATE knowledge_articles SET title=?, content=?, category=?, tags=?, status=?, updated_at=datetime('now') WHERE id=?").run(title, content, category, tags, status || 'draft', req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM knowledge_articles WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;
