import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { action, user_id, dateFrom, dateTo, offset = '0', limit = '10' } = req.query;
  const orgId = req.user!.organizationId;
  const limitInt = Math.max(1, Math.min(10000, parseInt(limit as string) || 10));
  const offsetInt = Math.max(0, parseInt(offset as string) || 0);

  const logs = await sql`
    SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.organization_id = ${orgId}
    ${action ? sql`AND al.action = ${action as string}` : sql``}
    ${user_id ? sql`AND al.user_id = ${user_id as string}` : sql``}
    ${dateFrom ? sql`AND al.created_at >= ${dateFrom as string}` : sql``}
    ${dateTo ? sql`AND al.created_at <= ${dateTo as string}` : sql``}
    ORDER BY al.created_at DESC
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `;

  const [{ c: total }] = await sql`
    SELECT COUNT(*)::int as c FROM audit_logs al
    WHERE al.organization_id = ${orgId}
    ${action ? sql`AND al.action = ${action as string}` : sql``}
    ${user_id ? sql`AND al.user_id = ${user_id as string}` : sql``}
    ${dateFrom ? sql`AND al.created_at >= ${dateFrom as string}` : sql``}
    ${dateTo ? sql`AND al.created_at <= ${dateTo as string}` : sql``}
  `;

  res.json({ logs, total });
});

router.get('/export', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const logs = await sql`
    SELECT al.id, u.name as user, al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.organization_id = ${orgId}
    ORDER BY al.created_at DESC
    LIMIT 5000
  `;
  const header = 'ID,User,Action,Entity Type,Entity ID,Details,IP,Timestamp';
  const rows = logs.map((r: any) =>
    [r.id, `"${r.user||''}"`, r.action, r.entity_type, r.entity_id, `"${(r.details||'').replace(/"/g,'""')}"`, r.ip_address, new Date(r.created_at).toISOString()].join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send([header, ...rows].join('\n'));
});

export default router;
