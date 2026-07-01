import { Router, Request, Response } from 'express';
import sanitizeHtml from 'sanitize-html';
import sql from '../db';
import { authenticate, requireRole, requireModule } from '../middleware/auth';

const router = Router();

// Replaces a regex blocklist (only stripped <script> tags and on*= attributes,
// so e.g. <iframe src="javascript:..."> or <a href="javascript:..."> passed
// straight through into storage) with a real allowlist-based sanitizer. Mirrors
// the allowlist the frontend separately applies at render time, so content is
// safe at rest too, not just when viewed through the current web client.
function sanitizeArticleContent(html: string): string {
  return sanitizeHtml(html || '', {
    allowedTags: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','strong','em','b','i','u','code','pre','blockquote','br','hr','span','a','table','thead','tbody','tr','th','td'],
    allowedAttributes: { a: ['href', 'title'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}

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

router.post('/', authenticate, requireModule('knowledge'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { title, content, category, tags } = req.body;
  const orgId = req.user!.organizationId;
  const safeContent = sanitizeArticleContent(content);
  const [{ id }] = await sql`
    INSERT INTO knowledge_articles (title, content, category, author_id, status, tags, organization_id)
    VALUES (${title}, ${safeContent}, ${category || ''}, ${req.user!.userId}, 'draft', ${tags || ''}, ${orgId})
    RETURNING id
  `;
  res.json({ id });
});

router.put('/:id', authenticate, requireModule('knowledge'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { title, content, category, tags, status } = req.body;
  const orgId = req.user!.organizationId;
  const [art] = await sql`SELECT author_id, status as current_status FROM knowledge_articles WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!art) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.user!.role === 'engineer') {
    if (art.author_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (status === 'published') { res.status(403).json({ error: 'Engineers cannot publish articles. Submit for lead/admin review.' }); return; }
  }
  const safeContent = sanitizeArticleContent(content);
  await sql`
    UPDATE knowledge_articles SET title=${title}, content=${safeContent}, category=${category}, tags=${tags}, status=${status || 'draft'}, updated_at=NOW()
    WHERE id=${req.params.id} AND organization_id=${orgId}
  `;
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireModule('knowledge'), requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  if (req.user!.role === 'engineer') { res.status(403).json({ error: 'Forbidden: engineers cannot delete knowledge articles' }); return; }
  await sql`DELETE FROM knowledge_articles WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  res.json({ message: 'Deleted' });
});

export default router;
