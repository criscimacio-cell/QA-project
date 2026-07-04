import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sql from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { sendRoleChangedEmail } from '../emailService';
import { logger } from '../logger';
import { Sentry } from '../sentry';

// free was 5, which the 5 seeded demo accounts alone already exhaust, blocking
// evaluators from adding a single extra user out of the box — bumped to 10.
const PLAN_USER_LIMITS: Record<string, number> = { free: 10, pro: 25, enterprise: Infinity };

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, 'avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${(req as any).user.userId}-${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg','image/png','image/gif','image/webp'].includes(file.mimetype)) { cb(new Error('Only JPG, PNG, GIF, WEBP allowed')); return; }
    cb(null, true);
  },
});

const router = Router();

router.get('/', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { limit = '20', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit as string) || 20, 200);
  const off = parseInt(offset as string) || 0;
  const users = await sql`SELECT id, name, email, role, department, avatar, active, created_at, last_login FROM users WHERE organization_id = ${orgId} LIMIT ${lim} OFFSET ${off}`;
  const [{ total }] = await sql`SELECT COUNT(*)::int as total FROM users WHERE organization_id = ${orgId}` as any[];
  res.json({ users, total, limit: lim, offset: off });
});

router.patch('/me/preferences', authenticate, async (req: Request, res: Response) => {
  const { preferences } = req.body;
  await sql`UPDATE users SET preferences = ${JSON.stringify(preferences)} WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ message: 'Preferences saved' });
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const [user] = await sql`SELECT id, name, email, role, department, avatar, preferences FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...user, preferences: JSON.parse(user.preferences || '{}') });
});

// Must be registered before `/:id` below — Express matches routes in
// registration order, so with `/:id` first, a request to /mention-search
// matched `/:id` with id="mention-search" instead, which then failed with a
// Postgres integer-cast error that (being unhandled) hung the request
// forever. This route was completely unreachable.
router.get('/mention-search', authenticate, async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || (q as string).trim().length < 1) { res.json([]); return; }
  const orgId = req.user!.organizationId;
  const users = await sql`
    SELECT id, name, avatar FROM users
    WHERE organization_id = ${orgId} AND active = TRUE AND name ILIKE ${'%' + (q as string).trim() + '%'}
    LIMIT 10
  `;
  res.json(users);
});

router.get('/:id', authenticate, requireRole('admin', 'lead', 'engineer'), async (req: Request, res: Response) => {
  if (req.params.id === 'me') return;
  const [user] = await sql`SELECT id, name, email, role, department, avatar, active, created_at, last_login FROM users WHERE id = ${req.params.id} AND organization_id = ${req.user!.organizationId}`;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, email, password, role, department } = req.body;
  const orgId = req.user!.organizationId;

  // Enforce per-plan user limits
  const [orgRow] = await sql`SELECT plan, role_permissions FROM organizations WHERE id = ${orgId}`;
  const planLimit = PLAN_USER_LIMITS[orgRow?.plan] ?? 5;
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM users WHERE organization_id = ${orgId} AND active = TRUE` as any[];
  if (count >= planLimit) {
    res.status(403).json({ error: `User limit reached for your plan (${planLimit} users on ${orgRow?.plan} plan). Please upgrade to add more users.` }); return;
  }

  // Validate role — must be a hardcoded role or an existing custom role in this org
  const assignedRole = role || 'viewer';
  const customRoles = Object.keys(orgRow?.role_permissions || {});
  const validRoles = [...VALID_ROLES, ...customRoles];
  if (!validRoles.includes(assignedRole)) {
    res.status(400).json({ error: `Invalid role: "${assignedRole}"` }); return;
  }

  // A missing password used to silently fall back to the same "password123"
  // used for every seeded demo account — a predictable, publicly documented
  // credential with no forced reset. Require the admin to set one explicitly.
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password is required and must be at least 8 characters' }); return;
  }
  const hash = bcrypt.hashSync(password, 10);
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
  try {
    const [{ id }] = await sql`INSERT INTO users (name, email, password_hash, role, department, avatar, organization_id) VALUES (${name}, ${email}, ${hash}, ${assignedRole}, ${department || ''}, ${avatar}, ${orgId}) RETURNING id`;
    await sql`INSERT INTO user_org_memberships (user_id, organization_id, role, active) VALUES (${id}, ${orgId}, ${assignedRole}, TRUE) ON CONFLICT (user_id, organization_id) DO NOTHING`;
    await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'USER_CREATE', 'user', ${id}, ${`Created user: ${email}`}, ${req.ip || ''}, ${orgId})`;
    res.json({ id, name, email, role: assignedRole });
  } catch { res.status(400).json({ error: 'Operation failed' }); }
});

router.put('/:id/activate', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  await sql`UPDATE users SET active = TRUE WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'USER_ACTIVATE', 'user', ${req.params.id}, ${`Activated user id=${req.params.id}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Activated' });
});

router.put('/:id/deactivate', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  // The frontend already blocks this in the UI, but that's client-side only
  // and trivially bypassed by calling the API directly — a one-click,
  // unrecoverable (without DB access) lockout for a single-admin org.
  if (parseInt(req.params.id) === req.user!.userId) { res.status(403).json({ error: 'Cannot deactivate your own account' }); return; }
  await sql`UPDATE users SET active = FALSE WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'USER_DEACTIVATE', 'user', ${req.params.id}, ${`Deactivated user id=${req.params.id}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Deactivated' });
});

const VALID_ROLES = ['admin', 'lead', 'engineer', 'viewer'];

router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, role, department, active, password } = req.body;
  const orgId = req.user!.organizationId;
  if (parseInt(req.params.id) === req.user!.userId && role !== undefined) { res.status(403).json({ error: 'Cannot change your own role' }); return; }
  // Self-role-change was already blocked, but nothing stopped an admin from
  // deactivating their own account through this same endpoint — a one-click,
  // unrecoverable (without DB access) lockout for a single-admin org.
  if (parseInt(req.params.id) === req.user!.userId && active === false) { res.status(403).json({ error: 'Cannot deactivate your own account' }); return; }
  if (role) {
    const [orgRow] = await sql`SELECT role_permissions FROM organizations WHERE id = ${orgId}`;
    const customRoles = Object.keys(orgRow?.role_permissions || {});
    const validRoles = [...VALID_ROLES, ...customRoles];
    if (!validRoles.includes(role)) { res.status(400).json({ error: `Invalid role: "${role}"` }); return; }
  }
  const [target] = await sql`SELECT email, name, role FROM users WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (password) {
    if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
    const hash = bcrypt.hashSync(password, 10);
    await sql`UPDATE users SET name=${name}, role=${role}, department=${department}, active=${active !== undefined ? active : true}, password_hash=${hash} WHERE id=${req.params.id} AND organization_id=${orgId}`;
  } else {
    await sql`UPDATE users SET name=${name}, role=${role}, department=${department}, active=${active !== undefined ? active : true} WHERE id=${req.params.id} AND organization_id=${orgId}`;
  }
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'USER_UPDATE', 'user', ${req.params.id}, ${`Updated user id=${req.params.id}`}, ${req.ip || ''}, ${orgId})`;
  if (role && target && target.role !== role) {
    try {
      const [org] = await sql`SELECT name FROM organizations WHERE id = ${orgId}`;
      await sendRoleChangedEmail(target.email, name || target.name, target.role, role, org?.name || 'your organization');
    } catch (e) { logger.error({ err: e }, 'Role-change email failed'); }
  }
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  if (parseInt(req.params.id) === req.user!.userId) { res.status(403).json({ error: 'Cannot deactivate your own account' }); return; }
  await sql`UPDATE users SET active = FALSE WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'USER_DEACTIVATE', 'user', ${req.params.id}, ${`Deactivated user id=${req.params.id}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Deactivated' });
});

router.put('/me/avatar', authenticate, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
  const f = req.file;
  if (!f) { res.status(400).json({ error: 'No image uploaded' }); return; }
  const [existing] = await sql`SELECT avatar FROM users WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}` as any[];
  if (existing?.avatar?.startsWith('/api/users/') && existing.avatar.includes('/avatar')) {
    const oldPath = path.join(UPLOAD_DIR, 'avatars', path.basename(existing.avatar));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const avatarUrl = `/api/users/${req.user!.userId}/avatar?v=${Date.now()}`;
  await sql`UPDATE users SET avatar = ${avatarUrl} WHERE id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}`;
  res.json({ avatar: avatarUrl });
});

router.get('/:id/avatar', authenticate, async (req: Request, res: Response) => {
  const [user] = await sql`SELECT avatar FROM users WHERE id = ${req.params.id} AND organization_id = ${req.user!.organizationId}`;
  if (!user) { res.status(404).end(); return; }
  const avatarDir = path.join(UPLOAD_DIR, 'avatars');
  if (fs.existsSync(avatarDir)) {
    const files = fs.readdirSync(avatarDir).filter(f => f.startsWith(`avatar-${req.params.id}-`));
    if (files.length > 0) {
      const latest = files.sort().at(-1)!;
      const filePath = path.join(avatarDir, latest);
      const ext = path.extname(latest).toLowerCase();
      const mime: Record<string,string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
      res.setHeader('Content-Type', mime[ext] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  res.redirect(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.params.id)}`);
});

router.use((err: any, _req: Request, res: Response, next: Function) => {
  Sentry.captureException(err);
  if (err?.code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'Image too large (max 2 MB)' }); return; }
  if (err?.message) { res.status(400).json({ error: err.message }); return; }
  next(err);
});

export default router;
