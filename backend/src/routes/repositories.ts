import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();

router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const repos = await sql`
    WITH RECURSIVE repo_tree AS (
      SELECT id, id AS root_id FROM repositories WHERE organization_id = ${orgId}
      UNION ALL
      SELECT r.id, rt.root_id FROM repositories r JOIN repo_tree rt ON r.parent_id = rt.id WHERE r.organization_id = ${orgId}
    )
    SELECT r.*, u.name as owner_name,
      (SELECT COUNT(*)::int FROM files f
       JOIN repo_tree rt ON f.repository_id = rt.id
       WHERE rt.root_id = r.id AND f.status != 'archived' AND f.organization_id = ${orgId}) as file_count
    FROM repositories r LEFT JOIN users u ON r.owner_id = u.id
    WHERE r.organization_id = ${orgId}
    ORDER BY r.parent_id NULLS FIRST, r.name
  `;
  res.json(repos);
}));

router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [repo] = await sql`SELECT * FROM repositories WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!repo) { res.status(404).json({ error: 'Not found' }); return; }
  const files = await sql`
    SELECT f.id, f.name, f.original_name, f.size, f.mime_type, f.status,
           f.project, f.module, f.category, f.jira_ticket, f.tags,
           f.description, f.version, f.created_at, f.updated_at,
           u.name as owner_name
    FROM files f
    LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.repository_id = ${req.params.id} AND f.status != 'archived' AND f.organization_id = ${orgId}
    ORDER BY f.updated_at DESC
  `;
  const children = await sql`
    WITH RECURSIVE repo_tree AS (
      SELECT id, id AS root_id FROM repositories WHERE organization_id = ${orgId}
      UNION ALL
      SELECT r.id, rt.root_id FROM repositories r JOIN repo_tree rt ON r.parent_id = rt.id WHERE r.organization_id = ${orgId}
    )
    SELECT r.*,
      (SELECT COUNT(*)::int FROM files f
       JOIN repo_tree rt ON f.repository_id = rt.id
       WHERE rt.root_id = r.id AND f.status != 'archived' AND f.organization_id = ${orgId}) as file_count
    FROM repositories r
    WHERE r.parent_id = ${req.params.id} AND r.organization_id = ${orgId}
    ORDER BY r.name
  `;
  res.json({ ...repo, files, children });
}));

router.post('/', authenticate, requireRole('admin', 'lead'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name, description, parent_id, type, project } = req.body;
  const [{ id }] = await sql`
    INSERT INTO repositories (name, description, parent_id, type, project, owner_id, organization_id)
    VALUES (${name}, ${description || ''}, ${parent_id || null}, ${type || 'folder'}, ${project || ''}, ${req.user!.userId}, ${orgId})
    RETURNING id
  `;
  res.json({ id });
}));

router.put('/:id', authenticate, requireRole('admin', 'lead'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [existing] = await sql`SELECT id FROM repositories WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, description, required_approvals } = req.body;
  const reqApprovals = Number(required_approvals) >= 1 ? Number(required_approvals) : 1;
  await sql`UPDATE repositories SET name=${name}, description=${description}, required_approvals=${reqApprovals} WHERE id=${req.params.id} AND organization_id=${orgId}`;
  res.json({ message: 'Updated' });
}));

router.delete('/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [existing] = await sql`SELECT id FROM repositories WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const descendants = await sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM repositories WHERE id = ${req.params.id} AND organization_id = ${orgId}
      UNION ALL
      SELECT r.id FROM repositories r JOIN tree t ON r.parent_id = t.id WHERE r.organization_id = ${orgId}
    )
    SELECT id FROM tree
  `;
  const ids = descendants.map((r: any) => r.id);

  await sql.begin(async tx => {
    await tx`UPDATE files SET repository_id = NULL WHERE repository_id = ANY(${ids}::int[]) AND organization_id = ${orgId}`;
    await tx`DELETE FROM repositories WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}`;
  });

  res.json({ message: 'Deleted' });
}));

export default router;
