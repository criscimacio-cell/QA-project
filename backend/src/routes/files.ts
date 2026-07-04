import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as Diff from 'diff';
import { encryptFile, decryptFileToBuffer } from '../fileEncryption';
import { extractText } from '../textExtractor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as (format: string, opts?: object) => import('archiver').Archiver;
import sql from '../db';
import { authenticate, requireRole, requireModule } from '../middleware/auth';
import {
  sendFileSubmittedEmail,
  sendFileApprovedEmail,
  sendFileRejectedEmail,
  sendFilePublishedEmail,
} from '../emailService';

const PLAN_STORAGE_LIMITS: Record<string, number> = {
  free: 1 * 1024 ** 3,        // 1 GB
  pro: 50 * 1024 ** 3,        // 50 GB
  enterprise: Infinity,
};
import { notificationQueue } from '../queue';
import { bustDashboardCache } from './dashboard';
import bcrypt from 'bcryptjs';
import { redis } from '../redis';
import { logger } from '../logger';
import { Sentry } from '../sentry';

const router = Router();

// Simple per-user rate limit: max 3 bulk uploads per minute. Backed by Redis
// (not an in-process Map) so the limit is shared across backend replicas —
// a Map here would let a user get 3 uploads per minute per replica instead
// of 3 total the moment this runs behind a load balancer with >1 instance.
// Fails open if Redis is unreachable, matching this codebase's existing
// Redis-is-a-nice-to-have posture elsewhere (see redis.ts).
async function checkBulkUploadLimit(userId: number): Promise<boolean> {
  try {
    const key = `bulkupload:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= 3;
  } catch {
    return true;
  }
}

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

// Neutralizes CSV/formula injection: a cell whose text starts with = + - or @
// can be interpreted as a formula by Excel/Sheets when the export is opened.
// A leading apostrophe forces "treat as text" and is not shown to the user.
function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// Shared checkout-lock check. When allowOverride is true, admin/lead can act
// despite the lock (matches the checkin route's force-checkin privilege);
// when false (upload, delete) the lock must be released first, by anyone,
// so overriding it is always an explicit, audited checkin rather than a
// silent side effect of an unrelated action.
async function checkFileLock(
  file: any,
  userId: number,
  role: string,
  allowOverride: boolean
): Promise<string | null> {
  if (!file.checked_out_by || file.checked_out_by === userId) return null;
  if (allowOverride && ['admin', 'lead'].includes(role)) return null;
  const [locker] = await sql`SELECT name FROM users WHERE id = ${file.checked_out_by}`;
  return `File is checked out by ${locker?.name || 'another user'} since ${file.checked_out_at}. Check it in first.`;
}

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => { cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`); },
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

router.get('/', authenticate, async (req: Request, res: Response) => {
  const { repository_id, status, project, category, search, folder_id, limit = '20', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit as string) || 20, 200);
  const off = parseInt(offset as string) || 0;
  const orgId = req.user!.organizationId;
  const isLead = ['admin','lead'].includes(req.user!.role);
  const rows = await sql`
    SELECT f.id, f.name, f.original_name, f.size, f.mime_type, f.status,
           f.project, f.module, f.category, f.jira_ticket, f.tags,
           f.description, f.version, f.created_at, f.updated_at,
           f.owner_id, f.repository_id, f.folder_id,
           f.checked_out_by, f.checked_out_at, co.name as checked_out_by_name,
           u.name as owner_name, r.name as repository_name, ff.name as folder_name,
           (f.download_password_hash IS NOT NULL) as is_password_protected,
           f.password_hint
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id LEFT JOIN users co ON co.id = f.checked_out_by LEFT JOIN file_folders ff ON f.folder_id = ff.id
    WHERE f.organization_id = ${orgId}
    AND f.deleted_at IS NULL
    ${!isLead ? sql`AND (f.owner_id = ${req.user!.userId} OR f.status IN ('published','approved'))` : sql``}
    ${repository_id ? sql`AND f.repository_id = ${repository_id as string}` : sql``}
    ${status ? sql`AND f.status = ${status as string}` : sql`AND f.status != 'archived'`}
    ${project ? sql`AND f.project = ${project as string}` : sql``}
    ${category ? sql`AND f.category = ${category as string}` : sql``}
    ${folder_id === 'root' ? sql`AND f.folder_id IS NULL` : folder_id ? sql`AND f.folder_id = ${folder_id as string}` : sql``}
    ${search ? sql`AND (
      f.name ILIKE ${'%'+search+'%'} OR
      f.original_name ILIKE ${'%'+search+'%'} OR
      f.description ILIKE ${'%'+search+'%'} OR
      f.tags ILIKE ${'%'+search+'%'} OR
      f.jira_ticket ILIKE ${'%'+search+'%'} OR
      f.project ILIKE ${'%'+search+'%'} OR
      f.module ILIKE ${'%'+search+'%'} OR
      f.category ILIKE ${'%'+search+'%'}
    )` : sql``}
    ORDER BY f.updated_at DESC
    LIMIT ${lim} OFFSET ${off}
  `;
  const [{ total }] = await sql`
    SELECT COUNT(*)::int as total FROM files f
    WHERE f.organization_id = ${orgId}
    AND f.deleted_at IS NULL
    ${!isLead ? sql`AND (f.owner_id = ${req.user!.userId} OR f.status IN ('published','approved'))` : sql``}
    ${repository_id ? sql`AND f.repository_id = ${repository_id as string}` : sql``}
    ${status ? sql`AND f.status = ${status as string}` : sql`AND f.status != 'archived'`}
    ${project ? sql`AND f.project = ${project as string}` : sql``}
    ${category ? sql`AND f.category = ${category as string}` : sql``}
    ${folder_id === 'root' ? sql`AND f.folder_id IS NULL` : folder_id ? sql`AND f.folder_id = ${folder_id as string}` : sql``}
    ${search ? sql`AND (
      f.name ILIKE ${'%'+search+'%'} OR
      f.original_name ILIKE ${'%'+search+'%'} OR
      f.description ILIKE ${'%'+search+'%'} OR
      f.tags ILIKE ${'%'+search+'%'} OR
      f.jira_ticket ILIKE ${'%'+search+'%'} OR
      f.project ILIKE ${'%'+search+'%'} OR
      f.module ILIKE ${'%'+search+'%'} OR
      f.category ILIKE ${'%'+search+'%'}
    )` : sql``}
  ` as any[];
  res.json({ files: rows, total, limit: lim, offset: off });
});

router.get('/search', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || (q as string).trim().length < 2) { res.json([]); return; }
  const orgId = req.user!.organizationId;
  const userId = req.user!.userId;
  const isLead = ['admin', 'lead'].includes(req.user!.role);
  const term = '%' + (q as string).trim() + '%';
  const results = await sql`
    SELECT f.id, f.name, f.original_name, f.status, f.project, f.module, f.version, f.updated_at,
           u.name as owner_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.organization_id = ${orgId}
      AND f.status != 'archived'
      ${!isLead ? sql`AND (f.owner_id = ${userId} OR f.status IN ('published','approved'))` : sql``}
      AND (f.name ILIKE ${term} OR f.original_name ILIKE ${term} OR f.description ILIKE ${term}
           OR f.tags ILIKE ${term} OR f.jira_ticket ILIKE ${term} OR f.project ILIKE ${term})
    ORDER BY f.updated_at DESC
    LIMIT 10
  `;
  res.json(results);
}));

router.get('/export', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const files = await sql`
    SELECT f.id, f.name, f.original_name, f.version, f.status, f.project, f.module, f.category, f.jira_ticket, f.tags, f.size, u.name as owner, r.name as repository, f.created_at, f.updated_at
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.organization_id = ${orgId}
    ORDER BY f.updated_at DESC
  `;
  const header = 'ID,Name,Original Name,Version,Status,Project,Module,Category,Jira Ticket,Tags,Size (bytes),Owner,Repository,Created,Updated';
  const rows = files.map((f: any) =>
    [f.id, csvCell(f.name), csvCell(f.original_name), f.version, f.status, csvCell(f.project), csvCell(f.module), csvCell(f.category), csvCell(f.jira_ticket), csvCell(f.tags), f.size, csvCell(f.owner), csvCell(f.repository), new Date(f.created_at).toISOString(), new Date(f.updated_at).toISOString()].join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="files-export-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send([header, ...rows].join('\n'));
});

router.post('/bulk-action', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req, res) => {
  const { ids, action } = req.body as { ids: number[]; action: 'archive' | 'delete' | 'submit' };
  if (!ids?.length || !action) { res.status(400).json({ error: 'ids and action required' }); return; }
  if (action === 'delete' && req.user!.role !== 'admin') { res.status(403).json({ error: 'Forbidden: only admins can bulk delete' }); return; }
  const role = req.user!.role;
  const userId = req.user!.userId;
  const orgId = req.user!.organizationId;

  let count = 0;
  let skipped = 0;

  if (action === 'archive') {
    const rows = await sql`SELECT id, owner_id, checked_out_by FROM files WHERE id = ANY(${ids}::int[]) AND status != 'archived' AND organization_id = ${orgId}`;
    const allowedIds = (rows as any[])
      .filter(r => !(role === 'engineer' && r.owner_id !== userId))
      .filter(r => !r.checked_out_by || r.checked_out_by === userId || ['admin', 'lead'].includes(role))
      .map(r => r.id);
    skipped = ids.length - allowedIds.length;
    if (allowedIds.length) {
      await sql`UPDATE files SET status='archived', updated_at=NOW() WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
      await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) SELECT ${userId}, 'ARCHIVE', 'file', id, 'Bulk archived', ${req.ip || ''}, ${orgId} FROM files WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
    }
    count = allowedIds.length;
  } else if (action === 'submit') {
    const rows = await sql`SELECT id, owner_id, checked_out_by FROM files WHERE id = ANY(${ids}::int[]) AND status = 'draft' AND organization_id = ${orgId}`;
    const allowedIds = (rows as any[])
      .filter(r => !(role === 'engineer' && r.owner_id !== userId))
      .filter(r => !r.checked_out_by || r.checked_out_by === userId || ['admin', 'lead'].includes(role))
      .map(r => r.id);
    skipped = ids.length - allowedIds.length;
    if (allowedIds.length) {
      await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
    }
    count = allowedIds.length;
  } else if (action === 'delete') {
    // No admin/lead override on delete — a locked file must be checked in
    // (or force-checked-in) first, same as the single-file delete route.
    const rows = await sql`SELECT id, checked_out_by FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}`;
    const allowedIds = (rows as any[]).filter(r => !r.checked_out_by).map(r => r.id);
    skipped = ids.length - allowedIds.length;
    if (allowedIds.length) {
      await sql.begin(async tx => {
        await tx`DELETE FROM file_comments WHERE file_id = ANY(${allowedIds}::int[])`;
        await tx`DELETE FROM file_versions WHERE file_id = ANY(${allowedIds}::int[])`;
        await tx`DELETE FROM approvals WHERE file_id = ANY(${allowedIds}::int[])`;
        await tx`DELETE FROM files WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
      });
    }
    count = allowedIds.length;
  }
  bustDashboardCache(orgId).catch(() => {});
  res.json({ message: `Bulk ${action} complete`, count, skipped });
});

router.post('/bulk-download', authenticate, requireModule('files'), async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: number[] };
  if (!ids?.length) { res.status(400).json({ error: 'No file ids provided' }); return; }
  const orgId = req.user!.organizationId;
  const isLead = ['admin', 'lead'].includes(req.user!.role);
  const files = await sql`
    SELECT id, name, original_name, path, mime_type, owner_id, status
    FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}
  `;
  const allowed = files.filter((f: any) =>
    isLead || f.owner_id === req.user!.userId || ['published', 'approved'].includes(f.status)
  );
  if (!allowed.length) { res.status(403).json({ error: 'No accessible files in selection' }); return; }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="files-${new Date().toISOString().slice(0,10)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  const seen = new Map<string, number>();
  for (const f of allowed) {
    const filePath = path.join(UPLOAD_DIR, f.path);
    if (!fs.existsSync(filePath)) continue;
    const ext = path.extname(f.original_name);
    const base = path.basename(f.original_name, ext);
    const count = seen.get(f.original_name) || 0;
    seen.set(f.original_name, count + 1);
    const zipName = count === 0 ? f.original_name : `${base}_(${count})${ext}`;
    archive.append(decryptFileToBuffer(filePath), { name: zipName });
  }
  await archive.finalize();
});

router.post('/bulk-submit', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!ids?.length) { res.status(400).json({ error: 'ids required' }); return; }
  const orgId = req.user!.organizationId;
  const role = req.user!.role;
  const userId = req.user!.userId;

  const rows = await sql`SELECT id, owner_id, checked_out_by FROM files WHERE id = ANY(${ids}::int[]) AND status = 'draft' AND organization_id = ${orgId}`;
  const allowedIds = (rows as any[])
    .filter(r => !(role === 'engineer' && r.owner_id !== userId))
    .filter(r => !r.checked_out_by || r.checked_out_by === userId || ['admin', 'lead'].includes(role))
    .map(r => r.id);
  const skipped = ids.length - allowedIds.length;

  if (allowedIds.length) {
    await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
  }
  // Notify leads/admins of each file that was just submitted
  const submitted = allowedIds.length ? await sql`
    SELECT f.id, f.name, u.name as owner_name
    FROM files f JOIN users u ON f.owner_id = u.id
    WHERE f.id = ANY(${allowedIds}::int[]) AND f.status = 'submitted' AND f.organization_id = ${orgId}
  ` : [];
  if (submitted.length) {
    const leads = await sql`SELECT id, name, email FROM users WHERE role IN ('admin','lead') AND active = TRUE AND organization_id = ${orgId}`;
    for (const f of submitted) {
      for (const lead of leads) {
        await notificationQueue.add('notify', { userId: lead.id, type: 'approval', title: 'Review Requested', message: `"${f.name}" submitted for review`, organizationId: orgId });
        try { await sendFileSubmittedEmail(lead.email, lead.name, f.owner_name, f.name, f.id); } catch {}
      }
    }
  }
  res.json({ message: 'Submitted for review', count: allowedIds.length, skipped });
});

// GET /checked-out — files currently checked out in this org
router.get('/checked-out', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const rows = await sql`
    SELECT f.id, f.name, f.original_name, f.checked_out_at,
           u.name as checked_out_by_name, u.id as checked_out_by_id,
           o.name as owner_name
    FROM files f
    LEFT JOIN users u ON f.checked_out_by = u.id
    LEFT JOIN users o ON f.owner_id = o.id
    WHERE f.organization_id = ${orgId}
      AND f.checked_out_by IS NOT NULL
      AND f.deleted_at IS NULL
    ORDER BY f.checked_out_at DESC
  `;
  res.json(rows);
});

// GET /trash — recycle bin contents (admin only)
router.get('/trash', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const rows = await sql`
    SELECT f.id, f.name, f.original_name, f.size, f.mime_type, f.deleted_at,
           u.name as owner_name, f.version, f.project, f.category
    FROM files f LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.organization_id = ${orgId} AND f.deleted_at IS NOT NULL
    ORDER BY f.deleted_at DESC
  `;
  res.json(rows);
});

// POST /bulk-metadata — bulk update project/category/tags
router.post('/bulk-metadata', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { ids, project, category, tags } = req.body;
  if (!ids?.length) { res.status(400).json({ error: 'No file IDs provided' }); return; }
  const orgId = req.user!.organizationId;
  const role = req.user!.role;
  const userId = req.user!.userId;

  const rows = await sql`SELECT id, owner_id, checked_out_by FROM files WHERE id = ANY(${ids}::int[]) AND organization_id = ${orgId}`;

  // Engineers can only edit their own files
  if (role === 'engineer') {
    const notOwned = (rows as any[]).filter(r => r.owner_id !== userId);
    if (notOwned.length > 0) { res.status(403).json({ error: 'You can only edit your own files' }); return; }
  }

  const allowedIds = (rows as any[])
    .filter(r => !r.checked_out_by || r.checked_out_by === userId || ['admin', 'lead'].includes(role))
    .map(r => r.id);
  const skipped = ids.length - allowedIds.length;

  if (allowedIds.length) {
    if (project !== undefined) await sql`UPDATE files SET project = ${project}, updated_at = NOW() WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
    if (category !== undefined) await sql`UPDATE files SET category = ${category}, updated_at = NOW() WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
    if (tags !== undefined) await sql`UPDATE files SET tags = ${tags}, updated_at = NOW() WHERE id = ANY(${allowedIds}::int[]) AND organization_id = ${orgId}`;
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${userId}, 'BULK_METADATA', 'file', 0, ${`Bulk metadata update on ${allowedIds.length} files`}, ${req.ip || ''}, ${orgId})`;
  }
  res.json({ message: `Updated ${allowedIds.length} file(s)`, skipped });
});

// POST /:id/checkout
router.post('/:id/checkout', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.userId;
  const [file] = await sql`SELECT id, checked_out_by, checked_out_at FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (file.checked_out_by && file.checked_out_by !== userId) {
    const [locker] = await sql`SELECT name FROM users WHERE id = ${file.checked_out_by}`;
    res.status(409).json({ error: `File is checked out by ${locker?.name || 'another user'} since ${file.checked_out_at}` });
    return;
  }
  if (file.checked_out_by === userId) {
    res.json({ checkedOutBy: userId, checkedOutAt: file.checked_out_at });
    return;
  }
  const [updated] = await sql`UPDATE files SET checked_out_by=${userId}, checked_out_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId} RETURNING checked_out_at`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${userId}, 'CHECKOUT', 'file', ${req.params.id}, 'Checked out file', ${req.ip || ''}, ${orgId})`;
  res.json({ checkedOutBy: userId, checkedOutAt: updated.checked_out_at });
}));

// POST /:id/checkin
router.post('/:id/checkin', authenticate, requireModule('files'), asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const [file] = await sql`SELECT id, checked_out_by FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!file.checked_out_by) { res.json({ message: 'Checked in' }); return; }
  if (file.checked_out_by !== userId && !['admin', 'lead'].includes(role)) {
    res.status(403).json({ error: 'File is checked out by another user' }); return;
  }
  await sql`UPDATE files SET checked_out_by=NULL, checked_out_at=NULL WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${userId}, 'CHECKIN', 'file', ${req.params.id}, 'Checked in file', ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Checked in' });
}));

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`
    SELECT f.id, f.name, f.original_name, f.size, f.mime_type, f.status,
           f.project, f.module, f.category, f.jira_ticket, f.tags,
           f.description, f.version, f.created_at, f.updated_at,
           f.owner_id, f.repository_id,
           f.checked_out_by, f.checked_out_at, co.name as checked_out_by_name,
           u.name as owner_name, r.name as repository_name
    FROM files f LEFT JOIN users u ON f.owner_id = u.id LEFT JOIN repositories r ON f.repository_id = r.id LEFT JOIN users co ON co.id = f.checked_out_by
    WHERE f.id = ${req.params.id} AND f.organization_id = ${orgId}
  `;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const versions = await sql`SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ${req.params.id} AND fv.organization_id = ${orgId} ORDER BY fv.version DESC`;
  // VIEW events omitted — too noisy, drowns meaningful audit trail
  res.json({ ...file, versions });
});

router.get('/:id/versions', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id, owner_id, status FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const versions = await sql`SELECT fv.*, u.name as created_by_name FROM file_versions fv LEFT JOIN users u ON fv.created_by = u.id WHERE fv.file_id = ${req.params.id} AND fv.organization_id = ${orgId} ORDER BY fv.version DESC`;
  res.json(versions);
});

router.post('/upload', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), upload.single('file'), async (req: Request, res: Response) => {
  const { repository_id, folder_id, project, module, category, jira_ticket, tags, description, version, change_log, download_password, password_hint } = req.body;
  const orgId = req.user!.organizationId;
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No file attached' }); return; }
  const name = req.body.name || f.originalname.replace(/\.[^/.]+$/, '');

  // Enforce per-plan storage limits
  const [orgRow] = await sql`SELECT plan FROM organizations WHERE id = ${orgId}`;
  const storageLimit = PLAN_STORAGE_LIMITS[orgRow?.plan] ?? PLAN_STORAGE_LIMITS.free;
  const [{ used }] = await sql`SELECT COALESCE(SUM(size),0)::bigint as used FROM files WHERE organization_id = ${orgId}` as any[];
  if (Number(used) + f.size > storageLimit) {
    fs.unlinkSync(path.join(UPLOAD_DIR, f.filename));
    const limitGB = storageLimit === Infinity ? '∞' : (storageLimit / 1024 ** 3).toFixed(0);
    res.status(403).json({ error: `Storage limit reached (${limitGB}GB on ${orgRow?.plan} plan). Please upgrade or free up space.` }); return;
  }

  // `repository_id = NULL` is never true in SQL, so files uploaded without a
  // repository (a perfectly normal case) could never match an existing row
  // here — every re-upload silently created a disconnected duplicate file
  // instead of a new version, and completely bypassed the checkout lock for
  // any unfiled file. `IS NOT DISTINCT FROM` treats NULL = NULL as a match.
  const [existing] = await sql`SELECT * FROM files WHERE name = ${name} AND repository_id IS NOT DISTINCT FROM ${repository_id || null} AND status != 'archived' AND organization_id = ${orgId}`;

  // Check-out lock: if file exists and is locked by another user. No
  // admin/lead override here — overriding a lock must be an explicit,
  // audited checkin (POST /:id/checkin) rather than a silent side effect
  // of uploading over someone else's in-progress edit.
  if (existing) {
    const lockErr = await checkFileLock(existing, req.user!.userId, req.user!.role, false);
    if (lockErr) {
      fs.unlinkSync(path.join(UPLOAD_DIR, f.filename));
      res.status(423).json({ error: lockErr }); return;
    }
  }

  let fileId: number;
  let newVersion: number;

  if (existing) {
    newVersion = existing.version + 1;
    await sql`UPDATE files SET version=${newVersion}, path=${f.filename}, size=${f.size}, mime_type=${f.mimetype}, jira_ticket=${jira_ticket || existing.jira_ticket}, tags=${tags || existing.tags}, description=${description || existing.description}, status='draft', checked_out_by=NULL, checked_out_at=NULL, updated_at=NOW() WHERE id=${existing.id} AND organization_id=${orgId}`;
    fileId = existing.id;
  } else {
    newVersion = parseInt(version) || 1;
    const pwHash = download_password ? await bcrypt.hash(download_password, 12) : null;
    const [{ id }] = await sql`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, folder_id, owner_id, version, status, project, module, category, jira_ticket, tags, description, download_password_hash, password_hint, organization_id)
      VALUES (${name}, ${f.originalname}, ${f.filename}, ${f.size}, ${f.mimetype}, ${repository_id || null}, ${folder_id || null}, ${req.user!.userId}, ${newVersion}, 'draft', ${project || ''}, ${module || ''}, ${category || ''}, ${jira_ticket || ''}, ${tags || ''}, ${description || ''}, ${pwHash}, ${password_hint || null}, ${orgId})
      RETURNING id
    `;
    fileId = id;
  }

  // Extract text BEFORE encryption (file is still plaintext at this point)
  const rawPathForExtract = path.join(UPLOAD_DIR, f.filename);
  const mimetypeForExtract = f.mimetype;
  const fileIdForExtract = fileId;
  extractText(rawPathForExtract, mimetypeForExtract).then(async (text) => {
    if (text) {
      await sql`UPDATE files SET content_text = ${text} WHERE id = ${fileIdForExtract}`.catch(() => {});
    }
  }).catch(() => {});
  try {
    encryptFile(path.join(UPLOAD_DIR, f.filename));
  } catch (e) {
    // encryptFile throws synchronously (e.g. a misconfigured FILE_ENCRYPTION_KEY).
    // It used to be called unguarded, which aborted the rest of this handler —
    // file_versions/audit_logs never got written and the client's request hung
    // forever with no response. Log loudly and keep going: the file is already
    // saved and its DB record already exists, so we still need to finish
    // writing it consistently and answer the request either way.
    logger.error({ err: e, fileId }, '[files] Encryption failed, stored unencrypted');
  }
  await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by, organization_id) VALUES (${fileId}, ${newVersion}, ${f.filename}, ${f.size}, ${change_log || (existing ? `Version ${newVersion} update` : 'Initial upload')}, ${req.user!.userId}, ${orgId})`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Uploaded: ${f.originalname}`}, ${req.ip || ''}, ${orgId})`;
  bustDashboardCache(orgId).catch(() => {});
  res.json({ id: fileId, version: newVersion, message: existing ? `New version ${newVersion} created` : 'File uploaded successfully' });
});

router.post('/bulk-upload', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), upload.array('files', 20), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await checkBulkUploadLimit(userId))) {
    res.status(429).json({ error: 'Too many bulk uploads. Please wait before uploading again.' });
    return;
  }

  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: 'No files attached' }); return; }
  const { repository_id, project, module, category } = req.body;
  const orgId = req.user!.organizationId;
  const [repo] = repository_id
    ? await sql`SELECT id FROM repositories WHERE id = ${repository_id as string} AND organization_id = ${orgId}`
    : [null];
  if (repository_id && !repo) { res.status(400).json({ error: 'Invalid repository' }); return; }

  const results = [];
  for (const f of files) {
    const name = f.originalname.replace(/\.[^/.]+$/, '');
    const [{ id: fileId }] = await sql`
      INSERT INTO files (name, original_name, path, size, mime_type, repository_id, owner_id, version, status, project, module, category, organization_id)
      VALUES (${name}, ${f.originalname}, ${f.filename}, ${f.size}, ${f.mimetype}, ${repository_id || null}, ${req.user!.userId}, 1, 'draft', ${project || ''}, ${module || ''}, ${category || ''}, ${orgId})
      RETURNING id
    `;
    // Extract text BEFORE encryption
    const bulkRawPath = path.join(UPLOAD_DIR, f.filename);
    const bulkMimetype = f.mimetype;
    const bulkFileId = fileId;
    extractText(bulkRawPath, bulkMimetype).then(async (text) => {
      if (text) {
        await sql`UPDATE files SET content_text = ${text} WHERE id = ${bulkFileId}`.catch(() => {});
      }
    }).catch(() => {});
    try {
      encryptFile(path.join(UPLOAD_DIR, f.filename));
    } catch (e) {
      logger.error({ err: e, fileId }, '[files] Encryption failed, stored unencrypted');
    }
    await sql`INSERT INTO file_versions (file_id, version, path, size, change_log, created_by, organization_id) VALUES (${fileId}, 1, ${f.filename}, ${f.size}, 'Initial upload', ${req.user!.userId}, ${orgId})`;
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'UPLOAD', 'file', ${fileId}, ${`Bulk uploaded: ${f.originalname}`}, ${req.ip || ''}, ${orgId})`;
    results.push({ id: fileId, name, originalName: f.originalname, size: f.size });
  }
  bustDashboardCache(orgId).catch(() => {});
  res.json({ uploaded: results.length, files: results });
});

router.put('/:id', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const { name, project, module, category, jira_ticket, tags, description, download_password, password_hint, remove_password } = req.body;
  const orgId = req.user!.organizationId;
  const [existing] = await sql`SELECT owner_id, checked_out_by, checked_out_at, name, project, module, category, jira_ticket, tags, description FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.user!.role === 'engineer' && existing.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  const lockErr = await checkFileLock(existing, req.user!.userId, req.user!.role, true);
  if (lockErr) { res.status(423).json({ error: lockErr }); return; }
  // Compute new password hash: set if provided, clear if remove_password=true, leave unchanged if neither
  let pwUpdate = sql``;
  if (remove_password === 'true' || remove_password === true) {
    pwUpdate = sql`, download_password_hash = NULL, password_hint = NULL`;
  } else if (download_password) {
    const pwHash = await bcrypt.hash(download_password, 12);
    pwUpdate = sql`, download_password_hash = ${pwHash}, password_hint = ${password_hint || null}`;
  } else if (password_hint !== undefined) {
    pwUpdate = sql`, password_hint = ${password_hint || null}`;
  }
  // Partial update: a field omitted from the request body keeps its current
  // value. postgres.js rejects `undefined` outright, and the only real
  // caller (the password-only save button) never sends name/project/etc,
  // so treating a missing key as "unchanged" rather than "clear it" is both
  // what avoids the crash and the only sane interpretation for a caller
  // that's updating one field.
  await sql`UPDATE files SET
    name=${name !== undefined ? name : existing.name},
    project=${project !== undefined ? project : existing.project},
    module=${module !== undefined ? module : existing.module},
    category=${category !== undefined ? category : existing.category},
    jira_ticket=${jira_ticket !== undefined ? jira_ticket : existing.jira_ticket},
    tags=${tags !== undefined ? tags : existing.tags},
    description=${description !== undefined ? description : existing.description},
    updated_at=NOW()
    ${pwUpdate}
    WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'FILE_UPDATE', 'file', ${req.params.id}, ${`Updated file id=${req.params.id}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Updated' });
});

router.post('/:id/submit', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [existing] = await sql`SELECT owner_id, checked_out_by, checked_out_at FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.user!.role === 'engineer' && existing.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  const lockErr = await checkFileLock(existing, req.user!.userId, req.user!.role, true);
  if (lockErr) { res.status(423).json({ error: lockErr }); return; }
  await sql`UPDATE files SET status='submitted', updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  const [file] = await sql`SELECT f.name, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=${req.params.id} AND f.organization_id=${orgId}`;
  const leads = await sql`SELECT id, name, email FROM users WHERE role IN ('admin','lead') AND active = TRUE AND organization_id = ${orgId}`;
  for (const lead of leads) {
    await notificationQueue.add('notify', { userId: lead.id, type: 'approval', title: 'Review Requested', message: `"${file?.name}" submitted for review`, organizationId: orgId });
    try { await sendFileSubmittedEmail(lead.email, lead.name, file?.owner_name, file?.name, Number(req.params.id)); } catch {}
  }
  res.json({ message: 'Submitted for review' });
});

router.post('/:id/approve', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const { status, comments } = req.body;
  const orgId = req.user!.organizationId;
  if (comments && typeof comments === 'string' && comments.length > 2000) {
    res.status(400).json({ error: 'Comment must be 2000 characters or fewer' }); return;
  }
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['submitted'], submitted: ['under_review','approved','draft'],
    under_review: ['approved','draft'], approved: ['under_review','draft','published'],
    published: ['archived','draft'],
  };
  const [cur] = await sql`
    SELECT f.status, f.repository_id, COALESCE(r.required_approvals, 1) as required_approvals
    FROM files f LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.id = ${req.params.id} AND f.organization_id = ${orgId}
  `;
  if (!cur) { res.status(404).json({ error: 'Not found' }); return; }
  if (!VALID_TRANSITIONS[cur.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot transition from '${cur.status}' to '${status as string}'` }); return;
  }

  // For 'approved' transitions, check multi-step approval chain
  let effectiveStatus = status as string;
  if (status === 'approved' || status === 'published') {
    const [{ approval_count }] = await sql`
      SELECT COUNT(*)::int as approval_count FROM approvals
      WHERE file_id = ${req.params.id} AND organization_id = ${orgId}
        AND status = 'approved' AND reviewer_id != ${req.user!.userId}
    ` as any[];
    // approval_count excludes current reviewer; adding 1 for this approval
    if ((approval_count + 1) < cur.required_approvals) {
      effectiveStatus = 'under_review';
    }
  }

  await sql`UPDATE files SET status=${effectiveStatus}, updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO approvals (file_id, reviewer_id, status, comments, organization_id) VALUES (${req.params.id}, ${req.user!.userId}, ${status as string}, ${comments || ''}, ${orgId})`;
  const [file] = await sql`SELECT f.name, f.owner_id, u.name as owner_name, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id WHERE f.id=${req.params.id} AND f.organization_id=${orgId}`;
  if (file) {
    await notificationQueue.add('notify', { userId: file.owner_id, type: 'approval', title: `File ${effectiveStatus === 'approved' ? 'Approved' : 'Status Updated'}`, message: `Your file "${file.name}" is now: ${effectiveStatus}`, organizationId: orgId });
    try {
      const [reviewer] = await sql`SELECT name FROM users WHERE id = ${req.user!.userId} AND organization_id = ${orgId}`;
      const reviewerName = reviewer?.name || 'A reviewer';
      const fileId = Number(req.params.id);
      if (effectiveStatus === 'approved') {
        await sendFileApprovedEmail(file.owner_email, file.owner_name, file.name, fileId, reviewerName);
      } else if (effectiveStatus === 'published') {
        await sendFilePublishedEmail(file.owner_email, file.owner_name, file.name, fileId);
      } else if (effectiveStatus === 'draft') {
        await sendFileRejectedEmail(file.owner_email, file.owner_name, file.name, fileId, reviewerName, comments);
      }
    } catch {}
  }
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'APPROVE', 'file', ${req.params.id}, ${`Changed status to ${effectiveStatus}`}, ${req.ip || ''}, ${orgId})`;
  bustDashboardCache(orgId).catch(() => {});
  res.json({ message: 'Status updated', status: effectiveStatus });
});

router.post('/:id/archive', authenticate, requireModule('files'), requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT status, owner_id, checked_out_by, checked_out_at FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.user!.role === 'engineer' && file.owner_id !== req.user!.userId) { res.status(403).json({ error: 'Forbidden: engineers can only archive their own files' }); return; }
  if (file.status === 'archived') { res.status(400).json({ error: 'File is already archived' }); return; }
  const lockErr = await checkFileLock(file, req.user!.userId, req.user!.role, true);
  if (lockErr) { res.status(423).json({ error: lockErr }); return; }
  await sql`UPDATE files SET status='archived', updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'ARCHIVE', 'file', ${req.params.id}, 'Archived file', ${req.ip || ''}, ${orgId})`;
  bustDashboardCache(orgId).catch(() => {});
  res.json({ message: 'Archived' });
});

router.post('/:id/restore', authenticate, requireRole('admin', 'lead'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT status FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (file.status !== 'archived') { res.status(400).json({ error: 'Only archived files can be restored' }); return; }
  await sql`UPDATE files SET status='draft', updated_at=NOW() WHERE id=${req.params.id} AND organization_id=${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'RESTORE', 'file', ${req.params.id}, 'Restored file from archive', ${req.ip || ''}, ${orgId})`;
  bustDashboardCache(orgId).catch(() => {});
  res.json({ message: 'Restored to draft' });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id, deleted_at, checked_out_by, checked_out_at FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  // No admin override — deleting a file someone is actively editing must go
  // through an explicit checkin first, not be silently allowed for admins.
  const lockErr = await checkFileLock(file, req.user!.userId, req.user!.role, false);
  if (lockErr) { res.status(423).json({ error: lockErr }); return; }
  if (file.deleted_at) {
    // Already in recycle bin — permanently delete
    const [full] = await sql`SELECT path FROM files WHERE id = ${req.params.id}`;
    if (full?.path) { const fp = path.join(UPLOAD_DIR, full.path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    // Historical version files were never cleaned up here, leaving every past
    // version's file orphaned on disk forever after a "permanent" delete.
    const versions = await sql`SELECT path FROM file_versions WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
    for (const v of versions as any[]) {
      if (!v.path) continue;
      const vp = path.join(UPLOAD_DIR, v.path);
      if (fs.existsSync(vp)) fs.unlinkSync(vp);
    }
    await sql.begin(async tx => {
      await tx`DELETE FROM file_versions WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
      await tx`DELETE FROM approvals WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
      await tx`DELETE FROM file_comments WHERE file_id = ${req.params.id} AND organization_id = ${orgId}`;
      await tx`DELETE FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
    });
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'DELETE_PERMANENT', 'file', ${req.params.id}, 'Permanently deleted file', ${req.ip || ''}, ${orgId})`;
    bustDashboardCache(orgId).catch(() => {});
    res.json({ message: 'Permanently deleted' }); return;
  }
  // Soft delete — move to recycle bin
  await sql`UPDATE files SET deleted_at = NOW(), status = 'archived', updated_at = NOW() WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'DELETE', 'file', ${req.params.id}, 'Moved to recycle bin', ${req.ip || ''}, ${orgId})`;
  bustDashboardCache(orgId).catch(() => {});
  res.json({ message: 'Moved to recycle bin' });
});

// POST /:id/restore-from-trash — restore a soft-deleted file
router.post('/:id/restore-from-trash', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT deleted_at FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file || !file.deleted_at) { res.status(400).json({ error: 'File is not in the recycle bin' }); return; }
  await sql`UPDATE files SET deleted_at = NULL, status = 'draft', updated_at = NOW() WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'RESTORE_TRASH', 'file', ${req.params.id}, 'Restored from recycle bin', ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Restored to draft' });
});

router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  // Rate limit: max 30 downloads per user per minute
  const dlKey = `dl_rate:${req.user!.userId}`;
  const dlCount = parseInt(await redis.get(dlKey) || '0', 10);
  if (dlCount >= 30) {
    res.status(429).json({ error: 'Too many download requests. Please wait a moment.' });
    return;
  }
  await redis.multi().incr(dlKey).expire(dlKey, 60).exec();

  const orgId = req.user!.organizationId;
  const userId = req.user!.userId;
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  // Password gate
  if (file.download_password_hash) {
    const attemptKey = `pw_attempts:${userId}:${req.params.id}`;
    const attempts = parseInt(await redis.get(attemptKey) || '0', 10);
    if (attempts >= 5) {
      const ttl = await redis.ttl(attemptKey);
      res.status(429).json({ error: 'Too many incorrect attempts. Try again later.', retry_after: ttl });
      return;
    }
    const provided = req.headers['x-file-password'] as string | undefined;
    if (!provided) {
      res.status(403).json({ error: 'password_required', hint: file.password_hint || null });
      return;
    }
    const valid = await bcrypt.compare(provided, file.download_password_hash);
    if (!valid) {
      const newCount = attempts + 1;
      await redis.setex(attemptKey, 15 * 60, String(newCount));
      await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${userId}, 'DOWNLOAD_PASSWORD_FAIL', 'file', ${req.params.id}, ${`Wrong password attempt ${newCount}/5`}, ${req.ip || ''}, ${orgId})`;
      res.status(401).json({ error: 'invalid_password', attempts_remaining: 5 - newCount });
      return;
    }
    // Correct — clear the counter
    await redis.del(attemptKey);
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${userId}, 'DOWNLOAD_PASSWORD_SUCCESS', 'file', ${req.params.id}, ${`Password verified for: ${file.original_name}`}, ${req.ip || ''}, ${orgId})`;
  }

  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${userId}, 'DOWNLOAD', 'file', ${req.params.id}, ${`Downloaded: ${file.original_name}`}, ${req.ip || ''}, ${orgId})`;
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    try {
      const decrypted = decryptFileToBuffer(filePath);
      res.setHeader('Content-Length', decrypted.length);
      res.end(decrypted);
    } catch { res.status(500).json({ error: 'Failed to decrypt file' }); }
  } else {
    res.status(404).json({ error: 'File not found on disk. This may be a demo record with no physical file.' });
  }
});

router.get('/:id/preview', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    const SAFE = new Set(['image/jpeg','image/png','image/gif','image/webp','image/bmp','application/pdf']);
    const mime = file.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', SAFE.has(mime) ? mime : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${SAFE.has(mime) ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.original_name)}"`);
    try {
      const decrypted = decryptFileToBuffer(filePath);
      res.setHeader('Content-Length', decrypted.length);
      res.end(decrypted);
    } catch { res.status(500).json({ error: 'Failed to decrypt file' }); }
  } else {
    res.status(404).json({ error: 'No preview available for demo records.' });
  }
});

router.get('/:id/versions/:version/download', authenticate, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT * FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  const [ver] = await sql`SELECT * FROM file_versions WHERE file_id = ${req.params.id} AND version = ${req.params.version} AND organization_id = ${orgId}`;
  if (!file || !ver) { res.status(404).json({ error: 'Not found' }); return; }
  const isAdminOrLead = ['admin', 'lead'].includes(req.user!.role);
  if (!isAdminOrLead && file.status === 'draft' && file.owner_id !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const filePath = path.join(UPLOAD_DIR, ver.path);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    try {
      const decrypted = decryptFileToBuffer(filePath);
      res.setHeader('Content-Length', decrypted.length);
      res.end(decrypted);
    } catch { res.status(500).json({ error: 'Failed to decrypt file' }); }
  } else {
    res.status(404).json({ error: 'Version file not found on disk.' });
  }
});

router.get('/:id/comments', authenticate, async (req, res) => {
  const orgId = req.user!.organizationId;
  // Verify file belongs to org first
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const comments = await sql`
    SELECT fc.*, u.name as user_name, u.avatar as user_avatar
    FROM file_comments fc JOIN users u ON fc.user_id = u.id
    WHERE fc.file_id = ${req.params.id} AND fc.organization_id = ${orgId}
    ORDER BY fc.created_at ASC
  `;
  res.json(comments);
});

router.post('/:id/comments', authenticate, requireRole('admin', 'lead', 'engineer'), async (req, res) => {
  const { comment } = req.body;
  const orgId = req.user!.organizationId;
  if (!comment?.trim()) { res.status(400).json({ error: 'Comment cannot be empty' }); return; }
  const [file] = await sql`SELECT id, name FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const [row] = await sql`
    INSERT INTO file_comments (file_id, user_id, comment, organization_id)
    VALUES (${req.params.id}, ${req.user!.userId}, ${comment.trim()}, ${orgId})
    RETURNING id, created_at
  `;
  const [poster] = await sql`SELECT name, avatar FROM users WHERE id = ${req.user!.userId} AND organization_id = ${orgId}`;

  // Parse @mentions and notify mentioned users
  const mentionMatches = comment.match(/@([\w.\- ]+?)(?=\s|$|@)/g) ?? [];
  if (mentionMatches.length) {
    const names = mentionMatches.map((m: string) => m.slice(1).trim()).filter(Boolean);
    if (names.length) {
      const mentioned = await sql`SELECT id, name FROM users WHERE name = ANY(${names}::text[]) AND organization_id = ${orgId} AND active = TRUE`;
      for (const mu of mentioned as any[]) {
        if (mu.id === req.user!.userId) continue;
        await notificationQueue.add('notify', {
          userId: mu.id,
          type: 'mention',
          title: 'You were mentioned',
          message: `${poster?.name || 'Someone'} mentioned you in a comment on "${file.name}"`,
          organizationId: orgId,
        });
      }
    }
  }

  res.json({ ...row, user_name: poster.name, user_avatar: poster.avatar, comment: comment.trim(), user_id: req.user!.userId, file_id: parseInt(req.params.id) });
});

router.delete('/:id/comments/:cid', authenticate, async (req, res) => {
  const orgId = req.user!.organizationId;
  const [c] = await sql`SELECT user_id FROM file_comments WHERE id = ${req.params.cid} AND file_id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!c) { res.status(404).json({ error: 'Not found' }); return; }
  if (c.user_id !== req.user!.userId && req.user!.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }
  await sql`DELETE FROM file_comments WHERE id = ${req.params.cid} AND organization_id = ${orgId}`;
  res.json({ message: 'Deleted' });
});

router.get('/:id/approvals', authenticate, async (req, res) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const history = await sql`
    SELECT a.*, u.name as reviewer_name, u.avatar as reviewer_avatar
    FROM approvals a JOIN users u ON a.reviewer_id = u.id
    WHERE a.file_id = ${req.params.id} AND a.organization_id = ${orgId}
    ORDER BY a.created_at DESC
  `;
  res.json(history);
});

// GET /api/files/:id/versions/diff?from=1&to=2
router.get('/:id/versions/diff', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const orgId = req.user!.organizationId;
  if (!from || !to || from === to) { res.status(400).json({ error: 'Provide distinct from and to version numbers' }); return; }

  const [file] = await sql`SELECT id, owner_id, status, original_name FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  if (!['admin','lead'].includes(req.user!.role) && file.owner_id !== req.user!.userId && !['published','approved'].includes(file.status)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const versions = await sql`SELECT version, path FROM file_versions WHERE file_id = ${req.params.id} AND version IN (${Number(from)}, ${Number(to)}) AND organization_id = ${orgId}`;
  if (versions.length < 2) { res.status(404).json({ error: 'One or both versions not found' }); return; }

  const verMap = Object.fromEntries((versions as any[]).map((v: any) => [v.version, v.path]));
  const pathA = path.join(UPLOAD_DIR, verMap[Number(from)]);
  const pathB = path.join(UPLOAD_DIR, verMap[Number(to)]);

  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) { res.status(404).json({ error: 'Version file(s) not found on disk' }); return; }

  const bufA = decryptFileToBuffer(pathA);
  const bufB = decryptFileToBuffer(pathB);

  // Size gate: refuse diffs > 2MB
  if (bufA.length > 2 * 1024 * 1024 || bufB.length > 2 * 1024 * 1024) {
    res.json({ diffable: false, reason: 'too_large' }); return;
  }

  // Binary detection: check first 512 bytes for non-text chars
  const sample = bufA.subarray(0, 512);
  const isBinary = sample.some((b: number) => b === 0 || (b > 127 && b < 160));
  if (isBinary) { res.json({ diffable: false, reason: 'binary' }); return; }

  const textA = bufA.toString('utf8');
  const textB = bufB.toString('utf8');
  const patch = Diff.createTwoFilesPatch(
    `v${from}/${file.original_name}`,
    `v${to}/${file.original_name}`,
    textA, textB, '', '', { context: 3 }
  );

  res.json({ diffable: true, from: Number(from), to: Number(to), patch });
}));

router.use((err: any, _req: Request, res: Response, next: Function) => {
  Sentry.captureException(err);
  if (err?.code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'File too large (max 50 MB)' }); return; }
  if (err?.message) { res.status(400).json({ error: err.message }); return; }
  next(err);
});

export default router;
