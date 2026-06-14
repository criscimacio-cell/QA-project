import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { q, type, project, category, dateFrom, dateTo } = req.query;
  if (!q) { res.json({ files: [], knowledge: [], total: 0 }); return; }

  let files: any[] = [];
  let knowledge: any[] = [];
  const query = q as string;

  if (!type || type === 'files' || type === 'all') {
    files = await sql`
      SELECT f.*, u.name as owner_name, r.name as repository_name
      FROM files f
      LEFT JOIN users u ON f.owner_id = u.id
      LEFT JOIN repositories r ON f.repository_id = r.id
      WHERE (
        to_tsvector('english', coalesce(f.name,'') || ' ' || coalesce(f.description,'') || ' ' || coalesce(f.tags,'') || ' ' || coalesce(f.project,'') || ' ' || coalesce(f.jira_ticket,''))
        @@ plainto_tsquery('english', ${query})
        OR f.name ILIKE ${'%' + query + '%'}
      )
      ${project ? sql`AND f.project = ${project as string}` : sql``}
      ${category ? sql`AND f.category = ${category as string}` : sql``}
      ${dateFrom ? sql`AND f.created_at >= ${dateFrom as string}` : sql``}
      ${dateTo ? sql`AND f.created_at <= ${dateTo as string}` : sql``}
      ORDER BY f.updated_at DESC LIMIT 20
    `;
  }

  if (!type || type === 'knowledge' || type === 'all') {
    knowledge = await sql`
      SELECT k.*, u.name as author_name FROM knowledge_articles k
      LEFT JOIN users u ON k.author_id = u.id
      WHERE (
        to_tsvector('english', coalesce(k.title,'') || ' ' || coalesce(k.tags,'') || ' ' || coalesce(k.category,''))
        @@ plainto_tsquery('english', ${query})
        OR k.title ILIKE ${'%' + query + '%'}
      )
      AND k.status = 'published'
      ORDER BY k.updated_at DESC LIMIT 10
    `;
  }

  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (${req.user!.userId}, 'SEARCH', 'search', 0, ${`Searched: ${q}`}, ${req.ip || ''})`;
  res.json({ files, knowledge, total: files.length + knowledge.length });
});

router.get('/suggestions', authenticate, async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) { res.json([]); return; }
  const s = '%' + q + '%';
  const fileNames = await sql`SELECT name FROM files WHERE name ILIKE ${s} LIMIT 5`;
  const articleTitles = await sql`SELECT title as name FROM knowledge_articles WHERE title ILIKE ${s} LIMIT 3`;
  res.json([...fileNames, ...articleTitles].map((r: any) => r.name));
});

export default router;
