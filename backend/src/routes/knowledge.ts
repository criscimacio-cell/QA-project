import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/categories/list', authenticate, async (req: Request, res: Response) => {
  const cats = await sql`
    SELECT name, COUNT(ka.id)::int as count FROM categories
    LEFT JOIN knowledge_articles ka ON ka.category = categories.name
    WHERE categories.type = 'knowledge' GROUP BY categories.name ORDER BY categories.name
  `;
  res.json(cats);
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { category, status, search } = req.query;
  const rows = await sql`
    SELECT k.*, u.name as author_name FROM knowledge_articles k
    LEFT JOIN users u ON k.author_id = u.id
    WHERE 1=1
    ${category ? sql`AND k.category = ${category as string}` : sql``}
    ${status ? sql`AND k.status = ${status as string}` : sql``}
    ${search ? sql`AND (k.title ILIKE ${'%' + search + '%'} OR k.content ILIKE ${'%' + search + '%'} OR k.tags ILIKE ${'%' + search + '%'})` : sql``}
    ORDER BY k.updated_at DESC
  `;
  res.json(rows);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const [article] = await sql`
    SELECT k.*, u.name as author_name FROM knowledge_articles k
    LEFT JOIN users u ON k.author_id = u.id WHERE k.id = ${req.params.id}
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
  const safeContent = (content || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-removed=');
  const [{ id }] = await sql`
    INSERT INTO knowledge_articles (title, content, category, author_id, status, tags)
    VALUES (${title}, ${safeContent}, ${category || ''}, ${req.user!.userId}, 'draft', ${tags || ''})
    RETURNING id
  `;
  res.json({ id });
});

router.put('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { title, content, category, tags, status } = req.body;
  if (req.user!.role === 'engineer') {
    const [art] = await sql`SELECT author_id FROM knowledge_articles WHERE id = ${req.params.id}`;
    if (!art || art.author_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  }
  const safeContent = (content || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-removed=');
  await sql`
    UPDATE knowledge_articles SET title=${title}, content=${safeContent}, category=${category}, tags=${tags}, status=${status || 'draft'}, updated_at=NOW()
    WHERE id=${req.params.id}
  `;
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  if (req.user!.role === 'engineer') {
    const [art] = await sql`SELECT author_id FROM knowledge_articles WHERE id = ${req.params.id}`;
    if (!art || art.author_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  }
  await sql`DELETE FROM knowledge_articles WHERE id = ${req.params.id}`;
  res.json({ message: 'Deleted' });
});

export default router;
