import { Queue, Worker } from 'bullmq';
import sql from './db';

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
    await sql`INSERT INTO notifications (user_id, type, title, message, organization_id) VALUES (${userId}, ${type}, ${title}, ${message}, ${orgId})`;
  },
  { connection, concurrency: 5 },
);

worker.on('failed', (job, err) => console.error(`Notification job ${job?.id} failed:`, err.message));
