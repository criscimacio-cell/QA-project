import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const { q, type, project, category, dateFrom, dateTo } = req.query;
  if (!q) { res.json({ files: [], knowledge: [], total: 0 }); return; }
  const s = `%${q}%`;
  let files: any[] = [];
  let knowledge: any[] = [];

  if (!type || type === 'files' || type === 'all') {
    let fq = `SELECT f.*, u.name as owner_name, r.name as repository_name FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id WHERE (f.name LIKE ? OR f.description LIKE ? OR f.tags LIKE ? OR f.jira_ticket LIKE ? OR f.project LIKE ?)`;
    const fp: any[] = [s, s, s, s, s];
    if (project) { fq += ' AND f.project = ?'; fp.push(project); }
    if (category) { fq += ' AND f.category = ?'; fp.push(category); }
    if (dateFrom) { fq += ' AND f.created_at >= ?'; fp.push(dateFrom); }
    if (dateTo) { fq += ' AND f.created_at <= ?'; fp.push(dateTo); }
    fq += ' ORDER BY f.updated_at DESC LIMIT 20';
    files = db.prepare(fq).all(...fp) as any[];
  }

  if (!type || type === 'knowledge' || type === 'all') {
    knowledge = db.prepare(`SELECT k.*, u.name as author_name FROM knowledge_articles k LEFT JOIN users u ON k.author_id = u.id WHERE (k.title LIKE ? OR k.content LIKE ? OR k.tags LIKE ?) AND k.status = 'published' ORDER BY k.updated_at DESC LIMIT 10`).all(s, s, s) as any[];
  }

  db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, 'SEARCH', 'search', 0, ?, ?)").run(req.user!.userId, `Searched: ${q}`, req.ip || '');
  res.json({ files, knowledge, total: files.length + knowledge.length });
});

router.get('/suggestions', authenticate, (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) { res.json([]); return; }
  const s = `%${q}%`;
  const fileNames = db.prepare('SELECT name FROM files WHERE name LIKE ? LIMIT 5').all(s) as any[];
  const articleTitles = db.prepare('SELECT title as name FROM knowledge_articles WHERE title LIKE ? LIMIT 3').all(s) as any[];
  res.json([...fileNames, ...articleTitles].map((r: any) => r.name));
});

export default router;
