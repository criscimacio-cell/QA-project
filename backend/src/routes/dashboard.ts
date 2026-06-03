import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, (req: Request, res: Response) => {
  const totalFiles = (db.prepare("SELECT COUNT(*) as c FROM files WHERE status != 'archived'").get() as any).c;
  const activeUsers = (db.prepare('SELECT COUNT(*) as c FROM users WHERE active = 1').get() as any).c;
  const uploadedToday = (db.prepare("SELECT COUNT(*) as c FROM files WHERE date(created_at) = date('now')").get() as any).c;
  const pendingApprovals = (db.prepare("SELECT COUNT(*) as c FROM files WHERE status IN ('submitted', 'under_review')").get() as any).c;
  const totalKB = (db.prepare("SELECT COUNT(*) as c FROM knowledge_articles WHERE status = 'published'").get() as any).c;
  const totalSize = (db.prepare("SELECT SUM(size) as s FROM files WHERE status != 'archived'").get() as any).s || 0;
  const auditEventsToday = (db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE date(created_at) = date('now')").get() as any).c;

  // Week-over-week upload growth
  const uploadsThisWeek = (db.prepare("SELECT COUNT(*) as c FROM files WHERE created_at >= datetime('now', '-7 days')").get() as any).c;
  const uploadsLastWeek = (db.prepare("SELECT COUNT(*) as c FROM files WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").get() as any).c;
  const uploadGrowth = uploadsLastWeek === 0
    ? (uploadsThisWeek > 0 ? '+100%' : '0%')
    : `${uploadsThisWeek >= uploadsLastWeek ? '+' : ''}${Math.round(((uploadsThisWeek - uploadsLastWeek) / uploadsLastWeek) * 100)}%`;

  const recentActivity = db.prepare(`
    SELECT al.*, u.name as user_name, u.avatar FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC LIMIT 10
  `).all();

  const topFiles = db.prepare(`
    SELECT f.name, f.project, f.category, COUNT(*) as downloads
    FROM audit_logs al JOIN files f ON al.entity_id = f.id
    WHERE al.action = 'DOWNLOAD'
    GROUP BY f.id ORDER BY downloads DESC LIMIT 5
  `).all();

  const repositoryStats = db.prepare(`
    SELECT r.name, COUNT(f.id) as file_count, SUM(f.size) as total_size
    FROM repositories r LEFT JOIN files f ON f.repository_id = r.id AND f.status != 'archived'
    WHERE r.parent_id IS NOT NULL
    GROUP BY r.id ORDER BY file_count DESC LIMIT 8
  `).all();

  const uploadTrend = [];
  for (let i = 6; i >= 0; i--) {
    const row = db.prepare(`SELECT COUNT(*) as count, date('now', '-' || ? || ' days') as day FROM files WHERE date(created_at) = date('now', '-' || ? || ' days')`).get(i, i) as any;
    uploadTrend.push({ day: row.day || `Day -${i}`, count: row.count });
  }

  const statusBreakdown = db.prepare(`SELECT status, COUNT(*) as count FROM files GROUP BY status`).all();

  res.json({ totalFiles, activeUsers, uploadedToday, pendingApprovals, totalKB, totalSize, auditEventsToday, uploadGrowth, recentActivity, topFiles, repositoryStats, uploadTrend, statusBreakdown });
});

export default router;
