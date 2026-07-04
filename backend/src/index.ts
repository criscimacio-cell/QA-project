import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Must be imported before any routes are defined: patches Express's router so
// a rejected promise in an async handler is forwarded to error-handling
// middleware instead of becoming an unhandled rejection that crashes the
// process. Most routes in this codebase are plain `async (req, res) => {}`
// handlers with no try/catch and no asyncHandler wrapper of their own.
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import http from 'http';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { attachWebSocketServer } from './wsServer';
import { initDb } from './initDb';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import repoRoutes from './routes/repositories';
import fileRoutes from './routes/files';
import knowledgeRoutes from './routes/knowledge';
import searchRoutes from './routes/search';
import dashboardRoutes from './routes/dashboard';
import notifRoutes from './routes/notifications';
import auditRoutes from './routes/audit';
import categoryRoutes from './routes/categories';
import backofficeRoutes from './routes/backoffice';
import orgSettingsRoutes from './routes/orgSettings';
import folderRoutes from './routes/folders';
import templateRoutes from './routes/templates';
import filePermissionsRouter from './routes/filePermissions';
import shareLinksRouter from './routes/shareLinks';
import savedSearchesRouter from './routes/savedSearches';
// Initialize BullMQ worker by importing the module
import './queue';
import { startPurgeJob, startBackupJob } from './queue';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

// Catches the case where someone copies .env.example straight to .env and
// deploys it as-is — these placeholder values are public (checked into the
// repo), so a prod instance running with any of them is trivially compromised.
if (process.env.NODE_ENV === 'production') {
  const placeholderSecrets: Record<string, boolean> = {
    JWT_SECRET: process.env.JWT_SECRET === 'change-this-to-a-long-random-secret-string-in-production',
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD === 'qtamp_dev',
    DATABASE_URL: (process.env.DATABASE_URL || '').includes(':qtamp_dev@'),
  };
  const stillDefault = Object.entries(placeholderSecrets).filter(([, isDefault]) => isDefault).map(([name]) => name);
  if (stillDefault.length > 0) {
    console.error(`FATAL: ${stillDefault.join(', ')} still set to the .env.example placeholder value. Refusing to start in production.`);
    process.exit(1);
  }
}

// Last-resort net for errors outside the request/response cycle (background
// jobs, fire-and-forget calls) that express-async-errors can't intercept.
// Logs and keeps the process alive rather than taking down every tenant.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app = express();
// Must be set before any middleware reads req.ip (rate limiter below) —
// without it, requests behind nginx all resolve to the proxy's IP, and
// express-rate-limit's X-Forwarded-For spoofing check throws on production
// traffic. TRUST_PROXY=1 in prod (behind nginx/ALB); 0 for direct/local access.
app.set('trust proxy', process.env.TRUST_PROXY === '1');
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // CSP on API responses only — frontend CSP is handled by nginx
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
});

// Key by the authenticated user when possible, falling back to IP for
// unauthenticated requests. Keying by IP alone meant every user behind the
// same NAT/corporate proxy shared one 200-request budget — one active
// session could lock out an entire office. This also lets each logged-in
// user run a normal SPA session (dashboard + notifications + navigation)
// without tripping the limiter on legitimate use.
function rateLimitKey(req: express.Request): string {
  const token = req.cookies?.accessToken ?? req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as any;
      if (payload?.userId) return `user:${payload.userId}`;
    } catch { /* fall through to IP */ }
  }
  return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(limiter);
app.use('/api/auth', authLimiter);
app.use('/api/backoffice/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/repositories', repoRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/backoffice', backofficeRoutes);
app.use('/api/org-settings', orgSettingsRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/files', filePermissionsRouter);
app.use('/api/files', shareLinksRouter);
app.use('/api/share', shareLinksRouter);
app.use('/api/saved-searches', savedSearchesRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Final safety net: catches anything forwarded via next(err), including
// errors express-async-errors funnels here from async route handlers that
// have no error handling of their own. Without this, Express's default
// handler would still apply, which is fine functionally but leaks stack
// traces outside production.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled route error]', err);
  if (res.headersSent) return;
  res.status(err?.status ?? 500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: Running with default demo credentials (password123). Change before deploying to production.');
}

(async () => {
  try {
    await initDb();
    startPurgeJob().catch((e) => console.error('[purge] Failed to start purge job:', e));
    startBackupJob().catch((e) => console.error('[backup] Failed to start backup job:', e));
    const server = http.createServer(app);
    attachWebSocketServer(server);
    server.listen(PORT, () => console.log(`Qlarity API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
})();

export default app;
