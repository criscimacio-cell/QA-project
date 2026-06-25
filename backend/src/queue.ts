import { Queue, Worker } from 'bullmq';
import path from 'path';
import sql from './db';
import { pushToUser } from './wsServer';

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

// Auto-purge recycle bin (files deleted > 30 days ago) + data retention enforcement
export async function startPurgeJob() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const purgeWorker = new Worker('purge', async () => {
    try {
      const sql_module = await import('./db');
      const sqlDb = sql_module.default;
      const PURGE_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
      const fsModule = await import('fs');

      // ── 1. Purge recycle bin (soft-deleted > 30 days) ─────────────────────
      const stale = await sqlDb`
        SELECT id, path FROM files
        WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
        LIMIT 100
      `;
      for (const file of stale) {
        if (file.path) {
          try {
            const fp = path.resolve(PURGE_UPLOAD_DIR, file.path);
            if (fp.startsWith(PURGE_UPLOAD_DIR + path.sep) && fsModule.existsSync(fp)) fsModule.unlinkSync(fp);
          } catch {}
        }
        await sqlDb`DELETE FROM file_versions WHERE file_id = ${file.id}`;
        await sqlDb`DELETE FROM approvals WHERE file_id = ${file.id}`;
        await sqlDb`DELETE FROM file_comments WHERE file_id = ${file.id}`;
        await sqlDb`DELETE FROM files WHERE id = ${file.id}`;
      }
      if (stale.length > 0) console.log(`[purge] Auto-purged ${stale.length} files from trash`);

      // ── 2. Data retention: archive files older than org's retention_days ──
      const orgs = await sqlDb`
        SELECT id, retention_days FROM organizations
        WHERE active = TRUE AND retention_days IS NOT NULL AND retention_days > 0
      `;
      for (const org of orgs) {
        const expired = await sqlDb`
          SELECT id FROM files
          WHERE organization_id = ${org.id}
            AND deleted_at IS NULL
            AND status NOT IN ('archived', 'draft')
            AND updated_at < NOW() - (${org.retention_days} || ' days')::INTERVAL
          LIMIT 200
        `;
        if (expired.length === 0) continue;
        const ids = expired.map((f: any) => f.id);
        await sqlDb`UPDATE files SET status = 'archived', updated_at = NOW() WHERE id = ANY(${ids}::int[])`;
        await sqlDb`
          INSERT INTO audit_logs (action, entity_type, entity_id, details, organization_id)
          VALUES ('RETENTION_ARCHIVE', 'file', 0, ${`Auto-archived ${ids.length} files per ${org.retention_days}-day retention policy`}, ${org.id})
        `;
        console.log(`[retention] Org ${org.id}: archived ${ids.length} files (>${org.retention_days} days old)`);
      }
    } catch (e) { console.error('[purge] Error:', e); }
  }, { connection });

  // Schedule purge every 24 hours using a repeatable job
  const purgeQueue = new Queue('purge', { connection });
  await purgeQueue.add('purge-trash', {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: 'daily-purge' });
}
