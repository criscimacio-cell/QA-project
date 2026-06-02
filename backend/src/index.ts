import express from 'express';
import cors from 'cors';
import path from 'path';
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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/repositories', repoRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

initDb();
app.listen(PORT, () => console.log(`Q-KTAMP API running on http://localhost:${PORT}`));

export default app;
