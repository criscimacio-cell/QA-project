import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const repos = await sql`
    SELECT r.*, u.name as owner_name,
      (SELECT COUNT(*)::int FROM files f WHERE f.repository_id = r.id AND f.status != 'archived') as file_count
    FROM repositories r LEFT JOIN users u ON r.owner_id = u.id
    ORDER BY r.parent_id NULLS FIRST, r.name
  `;
  res.json(repos);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const [repo] = await sql`SELECT * FROM repositories WHERE id = ${req.params.id}`;
  if (!repo) { res.status(404).json({ error: 'Not found' }); return; }
  const files = await sql`
    SELECT f.*, u.name as owner_name FROM files f
    LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.repository_id = ${req.params.id} AND f.status != 'archived'
    ORDER BY f.updated_at DESC
  `;
  const children = await sql`SELECT * FROM repositories WHERE parent_id = ${req.params.id} ORDER BY name`;
  res.json({ ...repo, files, children });
});

router.post('/', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const { name, description, parent_id, type, project } = req.body;
  const [{ id }] = await sql`
    INSERT INTO repositories (name, description, parent_id, type, project, owner_id)
    VALUES (${name}, ${description || ''}, ${parent_id || null}, ${type || 'folder'}, ${project || ''}, ${req.user!.userId})
    RETURNING id
  `;
  res.json({ id });
});

router.put('/:id', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const [existing] = await sql`SELECT id FROM repositories WHERE id = ${req.params.id}`;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, description } = req.body;
  await sql`UPDATE repositories SET name=${name}, description=${description} WHERE id=${req.params.id}`;
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const [existing] = await sql`SELECT id FROM repositories WHERE id = ${req.params.id}`;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  // Collect all descendant IDs via recursive CTE
  const descendants = await sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM repositories WHERE id = ${req.params.id}
      UNION ALL
      SELECT r.id FROM repositories r JOIN tree t ON r.parent_id = t.id
    )
    SELECT id FROM tree
  `;
  const ids = descendants.map((r: any) => r.id);

  await sql.begin(async tx => {
    await tx`UPDATE files SET repository_id = NULL WHERE repository_id = ANY(${ids}::int[])`;
    await tx`DELETE FROM repositories WHERE id = ANY(${ids}::int[])`;
  });

  res.json({ message: 'Deleted' });
});

export default router;
