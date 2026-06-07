import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('admin', 'lead'), (req: Request, res: Response) => {
  const { action, user_id, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
  const conditions: string[] = [];
  const params: any[] = [];
  if (action) { conditions.push('al.action = ?'); params.push(action); }
  if (user_id) { conditions.push('al.user_id = ?'); params.push(user_id); }
  if (dateFrom) { conditions.push('al.created_at >= ?'); params.push(dateFrom); }
  if (dateTo) { conditions.push('al.created_at <= ?'); params.push(dateTo); }
  const where = conditions.length ? ' AND ' + conditions.join(' AND ') : '';
  let query = `SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1${where}`;
  query += ' ORDER BY al.created_at DESC';
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  const logs = db.prepare(query).all(...params);
  const total = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs al WHERE 1=1${where}`).get(...params) as any).c;
  res.json({ logs, total });
});

export default router;
