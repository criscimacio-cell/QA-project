import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/categories/list', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const cats = await sql`
    SELECT c.name, COUNT(ka.id)::int as count FROM categories c
    LEFT JOIN knowledge_articles ka ON ka.category = c.name AND ka.organization_id = ${orgId}
    WHERE c.type = 'knowledge' AND c.organization_id = ${orgId}
    GROUP BY c.name ORDER BY c.name
  `;
  res.json(cats);
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { category, status, search } = req.query;
  const orgId = req.user!.organizationId;
  const rows = await sql`
    SELECT k.*, u.name as author_name FROM knowledge_articles k
    LEFT JOIN users u ON k.author_id = u.id
    WHERE k.organization_id = ${orgId}
    ${category ? sql`AND k.category = ${category as string}` : sql``}
    ${status ? sql`AND k.status = ${status as string}` : sql``}
    ${search ? sql`AND (k.title ILIKE ${'%' + search + '%'} OR k.content ILIKE ${'%' + search + '%'} OR k.tags ILIKE ${'%' + search + '%'})` : sql``}
    ORDER BY k.updated_at DESC
  `;
  res.json(rows);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [article] = await sql`
    SELECT k.*, u.name as author_name FROM knowledge_articles k
    LEFT JOIN users u ON k.author_id = u.id WHERE k.id = ${req.params.id} AND k.organization_id = ${orgId}
  `;
  if (!article) { res.status(404).json({ error: 'Not found' }); return; }
  const role = req.user!.role;
  if (!['admin','lead'].includes(role) && article.status !== 'published' && article.author_id !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  res.json(article);
});

router.post('/', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { title, content, category, tags } = req.body;
  const orgId = req.user!.organizationId;
  const safeContent = (content || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-removed=');
  const [{ id }] = await sql`
    INSERT INTO knowledge_articles (title, content, category, author_id, status, tags, organization_id)
    VALUES (${title}, ${safeContent}, ${category || ''}, ${req.user!.userId}, 'draft', ${tags || ''}, ${orgId})
    RETURNING id
  `;
  res.json({ id });
});

router.put('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { title, content, category, tags, status } = req.body;
  const orgId = req.user!.organizationId;
  const [art] = await sql`SELECT author_id, status as current_status FROM knowledge_articles WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!art) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.user!.role === 'engineer') {
    if (art.author_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (status === 'published') { res.status(403).json({ error: 'Engineers cannot publish articles. Submit for lead/admin review.' }); return; }
  }
  const safeContent = (content || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-removed=');
  await sql`
    UPDATE knowledge_articles SET title=${title}, content=${safeContent}, category=${category}, tags=${tags}, status=${status || 'draft'}, updated_at=NOW()
    WHERE id=${req.params.id} AND organization_id=${orgId}
  `;
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  if (req.user!.role === 'engineer') { res.status(403).json({ error: 'Forbidden: engineers cannot delete knowledge articles' }); return; }
  await sql`DELETE FROM knowledge_articles WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  res.json({ message: 'Deleted' });
});

export default router;
