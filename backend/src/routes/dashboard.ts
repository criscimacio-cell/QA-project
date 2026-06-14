import { Router, Request, Response } from 'express';
import sql from '../db';
import { authenticate } from '../middleware/auth';
import { getCached, invalidate } from '../redis';

const router = Router();

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  const stats = await getCached('dashboard:stats', 60, async () => {
    const [[{ c: totalFiles }], [{ c: activeUsers }], [{ c: uploadedToday }], [{ c: pendingApprovals }],
           [{ c: totalKB }], [{ s: totalSize }], [{ c: auditEventsToday }]] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM files WHERE status != 'archived'`,
      sql`SELECT COUNT(*)::int as c FROM users WHERE active = TRUE`,
      sql`SELECT COUNT(*)::int as c FROM files WHERE created_at::date = CURRENT_DATE`,
      sql`SELECT COUNT(*)::int as c FROM files WHERE status IN ('submitted','under_review')`,
      sql`SELECT COUNT(*)::int as c FROM knowledge_articles WHERE status = 'published'`,
      sql`SELECT COALESCE(SUM(size),0)::bigint as s FROM files WHERE status != 'archived'`,
      sql`SELECT COUNT(*)::int as c FROM audit_logs WHERE created_at::date = CURRENT_DATE`,
    ]);

    const [{ c: uploadsThisWeek }] = await sql`SELECT COUNT(*)::int as c FROM files WHERE created_at >= NOW() - INTERVAL '7 days'`;
    const [{ c: uploadsLastWeek }] = await sql`SELECT COUNT(*)::int as c FROM files WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'`;
    const uploadGrowth = uploadsLastWeek === 0
      ? (uploadsThisWeek > 0 ? '+100%' : '0%')
      : `${uploadsThisWeek >= uploadsLastWeek ? '+' : ''}${Math.round(((uploadsThisWeek - uploadsLastWeek) / uploadsLastWeek) * 100)}%`;

    const recentActivity = await sql`
      SELECT al.*, u.name as user_name, u.avatar FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 10
    `;

    const topFiles = await sql`
      SELECT f.name, f.project, f.category, COUNT(*)::int as downloads
      FROM audit_logs al JOIN files f ON al.entity_id = f.id
      WHERE al.action = 'DOWNLOAD' AND al.entity_type = 'file'
      GROUP BY f.id, f.name, f.project, f.category ORDER BY downloads DESC LIMIT 5
    `;

    const repositoryStats = await sql`
      SELECT r.name, COUNT(f.id)::int as file_count, COALESCE(SUM(f.size),0)::bigint as total_size
      FROM repositories r LEFT JOIN files f ON f.repository_id = r.id AND f.status != 'archived'
      WHERE r.parent_id IS NOT NULL
      GROUP BY r.id, r.name ORDER BY file_count DESC LIMIT 8
    `;

    const uploadTrend = [];
    for (let i = 6; i >= 0; i--) {
      const [row] = await sql`
        SELECT COUNT(*)::int as count, (CURRENT_DATE - ${i} * INTERVAL '1 day')::date::text as day
        FROM files WHERE created_at::date = CURRENT_DATE - ${i} * INTERVAL '1 day'
      `;
      uploadTrend.push({ day: row.day, count: row.count });
    }

    const statusBreakdown = await sql`SELECT status, COUNT(*)::int as count FROM files GROUP BY status`;

    return { totalFiles, activeUsers, uploadedToday, pendingApprovals, totalKB, totalSize: Number(totalSize),
             auditEventsToday, uploadGrowth, recentActivity, topFiles, repositoryStats, uploadTrend, statusBreakdown };
  });

  res.json(stats);
});

// Call this after file uploads/approvals to bust the cache
export async function bustDashboardCache() { await invalidate('dashboard:stats'); }

export default router;
