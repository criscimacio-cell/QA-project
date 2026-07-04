import app from './app';
import http from 'http';
import { attachWebSocketServer } from './wsServer';
import { initDb } from './initDb';
// Initialize BullMQ worker by importing the module
import './queue';
import { startPurgeJob, startBackupJob } from './queue';
import { logger } from './logger';

// These two pre-flight checks exit immediately — kept on plain console.error
// rather than the structured logger so the message is guaranteed to hit
// stderr before process.exit(), not deferred to it.
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
  logger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await initDb();
    startPurgeJob().catch((e) => logger.error({ err: e }, '[purge] Failed to start purge job'));
    startBackupJob().catch((e) => logger.error({ err: e }, '[backup] Failed to start backup job'));
    const server = http.createServer(app);
    attachWebSocketServer(server);
    server.listen(PORT, () => logger.info(`Qlarity API running on http://localhost:${PORT}`));
  } catch (err) {
    logger.error({ err }, 'Failed to initialize database');
    process.exit(1);
  }
})();
