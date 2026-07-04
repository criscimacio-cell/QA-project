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
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
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
import { logger } from './logger';
import { Sentry } from './sentry';

const app = express();
// Must be set before any middleware reads req.ip (rate limiter below) —
// without it, requests behind nginx all resolve to the proxy's IP, and
// express-rate-limit's X-Forwarded-For spoofing check throws on production
// traffic. TRUST_PROXY=1 in prod (behind nginx/ALB); 0 for direct/local access.
app.set('trust proxy', process.env.TRUST_PROXY === '1');
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
  Sentry.captureException(err);
  logger.error({ err }, 'unhandled route error');
  if (res.headersSent) return;
  res.status(err?.status ?? 500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  logger.warn('Running with default demo credentials (password123). Change before deploying to production.');
}

export default app;
