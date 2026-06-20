import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sql from '../db';
import { JWT_SECRET } from '../middleware/auth';

const router = Router();

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

  const [admin] = await sql`SELECT * FROM platform_admins WHERE email = ${email} AND active = TRUE`;
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
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
});

router.post('/auth/logout', authenticatePlatformAdmin, (_req: Request, res: Response) => {
  res.clearCookie('boAccessToken', { path: '/api/backoffice' });
  res.json({ message: 'Logged out' });
});

router.get('/auth/me', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const pa = (req as any).platformAdmin;
  const [admin] = await sql`SELECT id, name, email, active, last_login, created_at FROM platform_admins WHERE id = ${pa.adminId}`;
  if (!admin) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(admin);
});

// ── Platform Stats ──────────────────────────────────────────────────────────

router.get('/stats', authenticatePlatformAdmin, async (_req: Request, res: Response) => {
  const [[{ c: totalOrgs }], [{ c: activeOrgs }], [{ c: totalUsers }], [{ c: totalFiles }],
         [{ s: totalStorage }], [{ c: orgsThisMonth }]] = await Promise.all([
    sql`SELECT COUNT(*)::int as c FROM organizations`,
    sql`SELECT COUNT(*)::int as c FROM organizations WHERE active = TRUE`,
    sql`SELECT COUNT(*)::int as c FROM users WHERE active = TRUE`,
    sql`SELECT COUNT(*)::int as c FROM files WHERE status != 'archived'`,
    sql`SELECT COALESCE(SUM(size),0)::bigint as s FROM files`,
    sql`SELECT COUNT(*)::int as c FROM organizations WHERE created_at >= date_trunc('month', NOW())`,
  ]);

  const recentOrgs = await sql`
    SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at,
           COUNT(DISTINCT u.id)::int as user_count
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id AND u.active = TRUE
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 5
  `;

  const orgGrowth = await sql`
    SELECT TO_CHAR(date_trunc('month', created_at), 'Mon YY') as month,
           COUNT(*)::int as count
    FROM organizations
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at) ASC
  `;

  res.json({
    totalOrgs, activeOrgs, totalUsers, totalFiles,
    totalStorage: Number(totalStorage), orgsThisMonth,
    recentOrgs, orgGrowth,
  });
});

// ── Organizations ───────────────────────────────────────────────────────────

router.get('/organizations', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const { search, plan, status } = req.query;
  const orgs = await sql`
    SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at,
           COUNT(DISTINCT u.id)::int as user_count,
           COUNT(DISTINCT f.id)::int as file_count,
           COALESCE(SUM(f.size), 0)::bigint as storage_used
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id AND u.active = TRUE
    LEFT JOIN files f ON f.organization_id = o.id
    WHERE 1=1
    ${search ? sql`AND (o.name ILIKE ${'%' + (search as string) + '%'} OR o.slug ILIKE ${'%' + (search as string) + '%'})` : sql``}
    ${plan ? sql`AND o.plan = ${plan as string}` : sql``}
    ${status === 'active' ? sql`AND o.active = TRUE` : status === 'suspended' ? sql`AND o.active = FALSE` : sql``}
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;
  res.json(orgs);
});

router.get('/organizations/:id', authenticatePlatformAdmin, async (req: Request, res: Response) => {
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
    SELECT al.action, al.entity_type, al.details, al.created_at, u.name as user_name
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.organization_id = ${req.params.id}
    ORDER BY al.created_at DESC LIMIT 10
  `;

  res.json({ ...org, users, stats: stats[0], recentActivity });
});

router.put('/organizations/:id/suspend', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`UPDATE organizations SET active = FALSE WHERE id = ${req.params.id}`;
  res.json({ message: `Organization "${org.name}" suspended` });
});

router.put('/organizations/:id/activate', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${req.params.id}`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`UPDATE organizations SET active = TRUE WHERE id = ${req.params.id}`;
  res.json({ message: `Organization "${org.name}" activated` });
});

router.put('/organizations/:id/plan', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const { plan } = req.body;
  const VALID_PLANS = ['free', 'pro', 'enterprise'];
  if (!VALID_PLANS.includes(plan)) { res.status(400).json({ error: 'Invalid plan' }); return; }
  const [org] = await sql`UPDATE organizations SET plan = ${plan} WHERE id = ${req.params.id} RETURNING id, name`;
  if (!org) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ message: `Plan updated to "${plan}"` });
});

// ── Users (cross-org) ───────────────────────────────────────────────────────

router.get('/users', authenticatePlatformAdmin, async (req: Request, res: Response) => {
  const { search, org_id } = req.query;
  const users = await sql`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at, u.last_login,
           o.id as org_id, o.name as org_name, o.slug as org_slug
    FROM users u JOIN organizations o ON u.organization_id = o.id
    WHERE 1=1
    ${search ? sql`AND (u.name ILIKE ${'%' + (search as string) + '%'} OR u.email ILIKE ${'%' + (search as string) + '%'})` : sql``}
    ${org_id ? sql`AND u.organization_id = ${org_id as string}` : sql``}
    ORDER BY u.created_at DESC
    LIMIT 200
  `;
  res.json(users);
});

export default router;
