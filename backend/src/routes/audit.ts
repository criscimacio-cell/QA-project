import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const { action, user_id, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
  const limitInt = Math.max(1, Math.min(200, parseInt(limit as string) || 50));
  const offsetInt = Math.max(0, (parseInt(page as string) - 1)) * limitInt;

  const logs = await sql`
    SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
    ${action ? sql`AND al.action = ${action as string}` : sql``}
    ${user_id ? sql`AND al.user_id = ${user_id as string}` : sql``}
    ${dateFrom ? sql`AND al.created_at >= ${dateFrom as string}` : sql``}
    ${dateTo ? sql`AND al.created_at <= ${dateTo as string}` : sql``}
    ORDER BY al.created_at DESC
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `;

  const [{ c: total }] = await sql`
    SELECT COUNT(*)::int as c FROM audit_logs al
    WHERE 1=1
    ${action ? sql`AND al.action = ${action as string}` : sql``}
    ${user_id ? sql`AND al.user_id = ${user_id as string}` : sql``}
    ${dateFrom ? sql`AND al.created_at >= ${dateFrom as string}` : sql``}
    ${dateTo ? sql`AND al.created_at <= ${dateTo as string}` : sql``}
  `;

  res.json({ logs, total });
});

router.get('/export', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const logs = await sql`
    SELECT al.id, u.name as user, al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
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
