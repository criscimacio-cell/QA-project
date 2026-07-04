import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sql from '../db';
import { JWT_SECRET } from '../middleware/auth';
import { sendWelcomeEmail } from '../emailService';
import { logger } from '../logger';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const isProduction = process.env.NODE_ENV === 'production';
const BO_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: '/api/backoffice',
};

// ── Middleware ──────────────────────────────────────────────────────────────

function authenticatePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.boAccessToken ?? req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET(), { algorithms: ['HS256'] }) as any;
    if (payload.type !== 'platform_admin') { res.status(403).json({ error: 'Forbidden' }); return; }
    (req as any).platformAdmin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
  try {
    const [admin] = await sql`SELECT * FROM platform_admins WHERE email = ${email} AND active = TRUE`;
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }
    await sql`UPDATE platform_admins SET last_login = NOW() WHERE id = ${admin.id}`;
    const token = jwt.sign(
      { type: 'platform_admin', adminId: admin.id, email: admin.email, name: admin.name },
      JWT_SECRET(),
      { expiresIn: '8h', algorithm: 'HS256' }
    );
    res.cookie('boAccessToken', token, { ...BO_COOKIE_OPTS, expires: new Date(Date.now() + 8 * 60 * 60 * 1000) });
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err: any) {
    logger.error({ err }, '[backoffice login]');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/auth/logout', authenticatePlatformAdmin, (_req: Request, res: Response) => {
  res.clearCookie('boAccessToken', { path: '/api/backoffice' });
  res.json({ message: 'Logged out' });
});

router.get('/auth/me', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const pa = (req as any).platformAdmin;
  const [admin] = await sql`SELECT id, name, email, active, last_login, created_at FROM platform_admins WHERE id = ${pa.adminId}`;
  if (!admin) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(admin);
}));

// ── Platform Stats ──────────────────────────────────────────────────────────

router.get('/stats', authenticatePlatformAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const [[{ c: totalOrgs }], [{ c: activeOrgs }], [{ c: totalUsers }], [{ c: totalFiles }],
         [{ s: totalStorage }], [{ c: orgsThisMonth }]] = await Promise.all([
    sql`SELECT COUNT(*)::int as c FROM organizations WHERE archived_at IS NULL`,
    sql`SELECT COUNT(*)::int as c FROM organizations WHERE active = TRUE AND archived_at IS NULL`,
    sql`SELECT COUNT(*)::int as c FROM users WHERE active = TRUE`,
    sql`SELECT COUNT(*)::int as c FROM files WHERE status != 'archived'`,
    sql`SELECT COALESCE(SUM(size),0)::bigint as s FROM files WHERE status != 'archived'`,
    sql`SELECT COUNT(*)::int as c FROM organizations WHERE created_at >= date_trunc('month', NOW()) AND archived_at IS NULL`,
  ]);

  const recentOrgs = await sql`
    SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at,
           COUNT(DISTINCT u.id)::int as user_count
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id AND u.active = TRUE
    WHERE o.archived_at IS NULL
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 5
  `;

  const orgGrowth = await sql`
    SELECT TO_CHAR(date_trunc('month', created_at), 'Mon YY') as month,
           COUNT(*)::int as count
    FROM organizations
    WHERE created_at >= NOW() - INTERVAL '6 months' AND archived_at IS NULL
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at) ASC
  `;

  res.json({
    totalOrgs, activeOrgs, totalUsers, totalFiles,
    totalStorage: Number(totalStorage), orgsThisMonth,
    recentOrgs, orgGrowth,
  });
}));

// ── Organizations ───────────────────────────────────────────────────────────

router.get('/organizations', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { search, plan, status, limit = '50', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit as string) || 50, 200);
  const off = parseInt(offset as string) || 0;

  const orgs = await sql`
    SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at, o.archived_at,
           COUNT(DISTINCT u.id)::int as user_count,
           COUNT(DISTINCT f.id)::int as file_count,
           COALESCE(SUM(f.size), 0)::bigint as storage_used
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id AND u.active = TRUE
    LEFT JOIN files f ON f.organization_id = o.id
    WHERE 1=1
    ${search ? sql`AND (o.name ILIKE ${'%' + (search as string) + '%'} OR o.slug ILIKE ${'%' + (search as string) + '%'})` : sql``}
    ${plan ? sql`AND o.plan = ${plan as string}` : sql``}
    ${status === 'active' ? sql`AND o.active = TRUE AND o.archived_at IS NULL` : status === 'suspended' ? sql`AND o.active = FALSE AND o.archived_at IS NULL` : status === 'archived' ? sql`AND o.archived_at IS NOT NULL` : sql``}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ${lim} OFFSET ${off}
  `;

  const [{ total }] = await sql`
    SELECT COUNT(*)::int as total FROM organizations o
    WHERE 1=1
    ${search ? sql`AND (o.name ILIKE ${'%' + (search as string) + '%'} OR o.slug ILIKE ${'%' + (search as string) + '%'})` : sql``}
    ${plan ? sql`AND o.plan = ${plan as string}` : sql``}
    ${status === 'active' ? sql`AND o.active = TRUE AND o.archived_at IS NULL` : status === 'suspended' ? sql`AND o.active = FALSE AND o.archived_at IS NULL` : status === 'archived' ? sql`AND o.archived_at IS NOT NULL` : sql``}
  ` as any[];

  res.json({ orgs, total, limit: lim, offset: off });
}));

router.get('/organizations/:id', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const [org] = await sql`SELECT * FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }

  const users = await sql`
    SELECT id, name, email, role, department, avatar, active, created_at, last_login
    FROM users WHERE organization_id = ${req.params.id}
    ORDER BY created_at ASC
  `;

  const stats = await sql`
    SELECT
      COUNT(DISTINCT f.id)::int as total_files,
      COUNT(DISTINCT CASE WHEN f.status != 'archived' THEN f.id END)::int as active_files,
      COUNT(DISTINCT k.id)::int as kb_articles,
      COALESCE(SUM(f.size), 0)::bigint as storage_used
    FROM organizations o
    LEFT JOIN files f ON f.organization_id = o.id
    LEFT JOIN knowledge_articles k ON k.organization_id = o.id
    WHERE o.id = ${req.params.id}
  `;

  const recentActivity = await sql`
    SELECT al.id, al.action, al.entity_type, al.details, al.created_at, u.name as user_name
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.organization_id = ${req.params.id}
    ORDER BY al.created_at DESC LIMIT 20
  `;

  res.json({ ...org, users, stats: stats[0], recentActivity });
}));

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{2}$/;

router.post('/organizations', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const { name, slug, plan = 'free', adminName, adminEmail, adminPassword } = req.body;
  if (!name?.trim() || !slug?.trim()) { res.status(400).json({ error: 'name and slug are required' }); return; }
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: 'Invalid slug format' }); return; }
  const VALID_PLANS = ['free', 'pro', 'enterprise'];
  if (!VALID_PLANS.includes(plan)) { res.status(400).json({ error: 'Invalid plan' }); return; }

  const hasAdminFields = adminName || adminEmail || adminPassword;
  if (hasAdminFields && (!adminName?.trim() || !adminEmail?.trim() || !adminPassword)) {
    res.status(400).json({ error: 'All admin fields (name, email, password) are required together' }); return;
  }

  try {
    const result = await sql.begin(async tx => {
      const [existing] = await tx`SELECT id FROM organizations WHERE slug = ${slug.trim().toLowerCase()}`;
      if (existing) throw new Error('SLUG_TAKEN');
      const [org] = await tx`INSERT INTO organizations (name, slug, plan) VALUES (${name.trim()}, ${slug.trim().toLowerCase()}, ${plan}) RETURNING id, name, slug, plan`;

      let userId: number | null = null;
      if (adminName && adminEmail && adminPassword) {
        if (adminPassword.length < 8) throw new Error('PASSWORD_SHORT');
        const hash = await bcrypt.hash(adminPassword, 10);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(adminEmail.trim())}`;
        const [u] = await tx`INSERT INTO users (name, email, password_hash, role, organization_id, avatar) VALUES (${adminName.trim()}, ${adminEmail.trim().toLowerCase()}, ${hash}, 'admin', ${org.id}, ${avatar}) RETURNING id`;
        await tx`INSERT INTO user_org_memberships (user_id, organization_id, role, active) VALUES (${u.id}, ${org.id}, 'admin', TRUE) ON CONFLICT (user_id, organization_id) DO NOTHING`;
        userId = u.id;
      }
      return { org, userId };
    });

    if (result.userId) {
      try { await sendWelcomeEmail(adminEmail.trim().toLowerCase(), adminName.trim(), result.org.name); } catch (e) { logger.error({ err: e }, 'Welcome email failed'); }
    }

    res.status(201).json({ message: `Organization "${result.org.name}" created`, org: result.org });
  } catch (err: any) {
    if (err.message === 'SLUG_TAKEN') { res.status(409).json({ error: 'Slug already taken' }); return; }
    if (err.message === 'PASSWORD_SHORT') { res.status(400).json({ error: 'Admin password must be at least 8 characters' }); return; }
    if (err.code === '23505') { res.status(409).json({ error: 'Admin email already exists in this organization' }); return; }
    logger.error({ err }, 'Create org error');
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.post('/organizations/:id/users', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const { name, email, password, role = 'admin' } = req.body;
  if (!name?.trim() || !email?.trim() || !password) { res.status(400).json({ error: 'name, email and password are required' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
  const VALID_ROLES = ['admin', 'lead', 'engineer', 'viewer', 'member', 'manager'];
  if (!VALID_ROLES.includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  const [org] = await sql`SELECT id FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
  try {
    const hash = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email.trim())}`;
    const [user] = await sql`INSERT INTO users (name, email, password_hash, role, organization_id, avatar) VALUES (${name.trim()}, ${email.trim().toLowerCase()}, ${hash}, ${role}, ${req.params.id}, ${avatar}) RETURNING id, name, email, role`;
    await sql`INSERT INTO user_org_memberships (user_id, organization_id, role, active) VALUES (${user.id}, ${req.params.id}, ${role}, TRUE) ON CONFLICT (user_id, organization_id) DO NOTHING`;
    res.status(201).json({ message: `User "${name}" created in organization`, user });
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'Email already exists in this organization' }); return; }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/organizations/:id/users/:userId/toggle', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const [user] = await sql`SELECT id, active FROM users WHERE id = ${req.params.userId} AND organization_id = ${req.params.id}`;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const [updated] = await sql`UPDATE users SET active = ${!user.active} WHERE id = ${user.id} RETURNING id, name, active`;
  res.json({ message: `User ${updated.active ? 'activated' : 'deactivated'}`, user: updated });
}));

router.delete('/organizations/:id', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`UPDATE organizations SET active = FALSE, archived_at = NOW() WHERE id = ${req.params.id}`;
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE organization_id = ${req.params.id}`;
  res.json({ message: `Organization "${org.name}" archived and all sessions revoked` });
}));

router.put('/organizations/:id/suspend', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`UPDATE organizations SET active = FALSE WHERE id = ${req.params.id}`;
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE organization_id = ${req.params.id} AND revoked = FALSE`;
  res.json({ message: `Organization "${org.name}" suspended` });
}));

router.put('/organizations/:id/activate', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`UPDATE organizations SET active = TRUE WHERE id = ${req.params.id}`;
  res.json({ message: `Organization "${org.name}" activated` });
}));

router.put('/organizations/:id/plan', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { plan } = req.body;
  const VALID_PLANS = ['free', 'pro', 'enterprise'];
  if (!VALID_PLANS.includes(plan)) { res.status(400).json({ error: 'Invalid plan' }); return; }
  const [org] = await sql`UPDATE organizations SET plan = ${plan} WHERE id = ${req.params.id} RETURNING id, name`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ message: `Plan updated to "${plan}"` });
}));

// ── Users (cross-org) ───────────────────────────────────────────────────────

router.get('/users', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { search, org_id, limit = '50', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit as string) || 50, 200);
  const off = parseInt(offset as string) || 0;

  const users = await sql`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at, u.last_login,
           o.id as org_id, o.name as org_name, o.slug as org_slug
    FROM users u JOIN organizations o ON u.organization_id = o.id
    WHERE 1=1
    ${search ? sql`AND (u.name ILIKE ${'%' + (search as string) + '%'} OR u.email ILIKE ${'%' + (search as string) + '%'})` : sql``}
    ${org_id ? sql`AND u.organization_id = ${org_id as string}` : sql``}
    ORDER BY u.created_at DESC
    LIMIT ${lim} OFFSET ${off}
  `;

  const [{ total }] = await sql`
    SELECT COUNT(*)::int as total FROM users u
    WHERE 1=1
    ${search ? sql`AND (u.name ILIKE ${'%' + (search as string) + '%'} OR u.email ILIKE ${'%' + (search as string) + '%'})` : sql``}
    ${org_id ? sql`AND u.organization_id = ${org_id as string}` : sql``}
  ` as any[];

  res.json({ users, total, limit: lim, offset: off });
}));

// Run retention: archive files older than N days for an org
router.post('/organizations/:id/retention', authenticatePlatformAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.body;
  if (!days || isNaN(Number(days)) || Number(days) < 1) {
    res.status(400).json({ error: 'days must be a positive number' }); return;
  }
  const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
  const result = await sql`
    UPDATE files SET status = 'archived', updated_at = NOW()
    WHERE organization_id = ${req.params.id}
      AND status NOT IN ('archived')
      AND updated_at < NOW() - (${Number(days)} || ' days')::interval
    RETURNING id
  `;
  res.json({ message: `Archived ${result.length} files older than ${days} days`, count: result.length });
}));

router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, '[backoffice]');
  res.status(500).json({ error: 'Internal server error' });
});

export default router;
