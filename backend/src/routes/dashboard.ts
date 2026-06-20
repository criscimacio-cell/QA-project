import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { getCached, invalidate } from '../redis';

const router = Router();

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const cacheKey = `dashboard:stats:${orgId}:${req.user!.role}`;
  const stats = await getCached(cacheKey, 60, async () => {
    const [[{ c: totalFiles }], [{ c: activeUsers }], [{ c: uploadedToday }], [{ c: pendingApprovals }],
           [{ c: totalKB }], [{ s: totalSize }], [{ c: auditEventsToday }]] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM files WHERE status != 'archived' AND organization_id = ${orgId}`,
      sql`SELECT COUNT(*)::int as c FROM users WHERE active = TRUE AND organization_id = ${orgId}`,
      sql`SELECT COUNT(*)::int as c FROM files WHERE created_at::date = CURRENT_DATE AND organization_id = ${orgId}`,
      sql`SELECT COUNT(*)::int as c FROM files WHERE status IN ('submitted','under_review') AND organization_id = ${orgId}`,
      sql`SELECT COUNT(*)::int as c FROM knowledge_articles WHERE status = 'published' AND organization_id = ${orgId}`,
      sql`SELECT COALESCE(SUM(size),0)::bigint as s FROM files WHERE status != 'archived' AND organization_id = ${orgId}`,
      sql`SELECT COUNT(*)::int as c FROM audit_logs WHERE created_at::date = CURRENT_DATE AND organization_id = ${orgId}`,
    ]);

    const [{ c: uploadsThisWeek }] = await sql`SELECT COUNT(*)::int as c FROM files WHERE created_at >= NOW() - INTERVAL '7 days' AND organization_id = ${orgId}`;
    const [{ c: uploadsLastWeek }] = await sql`SELECT COUNT(*)::int as c FROM files WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' AND organization_id = ${orgId}`;
    const uploadGrowth = uploadsLastWeek === 0
      ? (uploadsThisWeek > 0 ? 100 : 0)
      : Math.round(((uploadsThisWeek - uploadsLastWeek) / uploadsLastWeek) * 100);

    const recentActivity = await sql`
      SELECT al.*, u.name as user_name, u.avatar FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action NOT IN ('LOGIN_FAIL', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'LOGIN', 'LOGOUT')
        AND al.organization_id = ${orgId}
      ORDER BY al.created_at DESC LIMIT 10
    `;

    const topFiles = await sql`
      SELECT f.name, f.project, f.category, COUNT(*)::int as downloads
      FROM audit_logs al JOIN files f ON al.entity_id = f.id
      WHERE al.action = 'DOWNLOAD' AND al.entity_type = 'file' AND al.organization_id = ${orgId}
      GROUP BY f.id, f.name, f.project, f.category ORDER BY downloads DESC LIMIT 5
    `;

    const repositoryStats = await sql`
      SELECT r.name, COUNT(f.id)::int as file_count, COALESCE(SUM(f.size),0)::bigint as total_size
      FROM repositories r LEFT JOIN files f ON f.repository_id = r.id AND f.status != 'archived' AND f.organization_id = ${orgId}
      WHERE r.organization_id = ${orgId}
      GROUP BY r.id, r.name ORDER BY file_count DESC LIMIT 8
    `;

    const uploadTrendRaw = await sql`
      SELECT
        d::date::text as day,
        COUNT(f.id)::int as count
      FROM generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS d
      LEFT JOIN files f ON f.created_at::date = d::date AND f.organization_id = ${orgId}
      GROUP BY d
      ORDER BY d ASC
    `;
    const uploadTrend = uploadTrendRaw.map((r: any) => ({ day: r.day, count: r.count }));

    const statusBreakdown = await sql`SELECT status, COUNT(*)::int as count FROM files WHERE organization_id = ${orgId} GROUP BY status`;

    return { totalFiles, activeUsers, uploadedToday, pendingApprovals, totalKB, totalSize: Number(totalSize),
             auditEventsToday, uploadGrowth, recentActivity, topFiles, repositoryStats, uploadTrend, statusBreakdown };
  });

  res.json(stats);
});

router.get('/activity', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const activity = await sql`
    SELECT al.*, u.name as user_name, u.avatar as user_avatar
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.action NOT IN ('LOGIN_FAIL', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'LOGIN', 'LOGOUT')
      AND al.organization_id = ${orgId}
    ORDER BY al.created_at DESC
    LIMIT ${limit}
  `;
  res.json(activity);
});

export async function bustDashboardCache(orgId: number) {
  await Promise.all([
    invalidate(`dashboard:stats:${orgId}:admin`),
    invalidate(`dashboard:stats:${orgId}:lead`),
    invalidate(`dashboard:stats:${orgId}:engineer`),
    invalidate(`dashboard:stats:${orgId}:viewer`),
  ]);
}

export default router;
