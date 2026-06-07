import dotenv from 'dotenv';
import path from 'path';
// Load .env from repo root (works whether running from backend/ or root)
// Try repo root .env first, then fallback to cwd .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { initDb } from './db';
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
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

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

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

initDb();
app.listen(PORT, () => console.log(`Q-KTAMP API running on http://localhost:${PORT}`));

export default app;
