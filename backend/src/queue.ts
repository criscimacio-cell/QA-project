import { Queue, Worker } from 'bullmq';
import sql from './db';
import { pushToUser } from './wsServer';
import { runBackup } from './backup';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(REDIS_URL);
const connection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
};

export const notificationQueue = new Queue('notifications', { connection });

const worker = new Worker(
  'notifications',
  async (job) => {
    const { userId, type, title, message, organizationId } = job.data as { userId: number; type: string; title: string; message: string; organizationId?: number };
    const orgId = organizationId ?? 1;
    const [saved] = await sql`INSERT INTO notifications (user_id, type, title, message, organization_id) VALUES (${userId}, ${type}, ${title}, ${message}, ${orgId}) RETURNING *`;
    // Push real-time notification to connected WebSocket clients
    pushToUser(userId, { type: 'notification', notification: saved });
  },
  { connection, concurrency: 5 },
);

worker.on('failed', (job, err) => console.error(`Notification job ${job?.id} failed:`, err.message));

// Export connection config so purge job can reuse it
export const redis = connection;

// Auto-purge recycle bin (files deleted > 30 days ago)
export async function startPurgeJob() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const purgeWorker = new Worker('purge', async () => {
    try {
      const sql_module = await import('./db');
      const sqlDb = sql_module.default;
      const PURGE_UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
      const fsModule = await import('fs');
      const pathModule = await import('path');
      const stale = await sqlDb`
        SELECT id, path FROM files
        WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
        LIMIT 100
      `;
      for (const file of stale) {
        if (file.path) {
          const fp = pathModule.join(PURGE_UPLOAD_DIR, file.path);
          if (fsModule.existsSync(fp)) fsModule.unlinkSync(fp);
        }
        await sqlDb`DELETE FROM file_versions WHERE file_id = ${file.id}`;
        await sqlDb`DELETE FROM approvals WHERE file_id = ${file.id}`;
        await sqlDb`DELETE FROM file_comments WHERE file_id = ${file.id}`;
        await sqlDb`DELETE FROM files WHERE id = ${file.id}`;
      }
      if (stale.length > 0) console.log(`[purge] Auto-purged ${stale.length} files from trash`);
    } catch (e) { console.error('[purge] Error:', e); }
  }, { connection });

  // Schedule purge every 24 hours using a repeatable job
  const purgeQueue = new Queue('purge', { connection });
  await purgeQueue.add('purge-trash', {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: 'daily-purge' });
}

// Nightly local backup: pg_dump the database + zip the uploads folder,
// written outside the live data path, with automatic retention rotation.
// See backend/src/backup.ts for the actual dump/archive/rotate logic.
export async function startBackupJob() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const backupWorker = new Worker('backup', async () => {
    try {
      await runBackup();
    } catch (e) { console.error('[backup] Error:', e); }
  }, { connection });

  backupWorker.on('failed', (job, err) => console.error(`[backup] Job ${job?.id} failed:`, err.message));

  // 2:00 AM daily
  const backupQueue = new Queue('backup', { connection });
  await backupQueue.add('nightly-backup', {}, { repeat: { pattern: '0 2 * * *' }, jobId: 'nightly-backup' });
}
