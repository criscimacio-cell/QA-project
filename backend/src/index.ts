import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import http from 'http';
import rateLimit from 'express-rate-limit';
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
import { startPurgeJob } from './queue';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const app = express();
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
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

if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: Running with default demo credentials (password123). Change before deploying to production.');
}

(async () => {
  try {
    await initDb();
    startPurgeJob().catch((e) => console.error('[purge] Failed to start purge job:', e));
    const server = http.createServer(app);
    attachWebSocketServer(server);
    server.listen(PORT, () => console.log(`Qlarity API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
})();

export default app;
