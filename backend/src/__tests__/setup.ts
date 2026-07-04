import { beforeAll, afterAll } from 'vitest';
import sql from '../db';
import { initDb } from '../initDb';
import { redis } from '../redis';
import { subscriber } from '../wsServer';
import { notificationQueue, worker } from '../queue';

// Runs once per test file (vitest isolates module state per file by
// default), so each file starts from the same clean, deterministic schema
// + seed data rather than depending on leftover state from another file.
beforeAll(async () => {
  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  if (tables.length > 0) {
    const names = tables.map((t) => `"${t.tablename}"`).join(', ');
    await sql.unsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  }
  await redis.flushdb().catch(() => {});
  await initDb();
});

// Closes every long-lived connection app.ts's import graph opens (BullMQ
// worker + queue, the WS pub/sub subscriber, the cache/rate-limit redis
// client, the Postgres pool) — without this the process never exits after
// the suite finishes, since these are all persistent sockets, not per-request.
afterAll(async () => {
  await worker.close();
  await notificationQueue.close();
  await subscriber.quit().catch(() => {});
  await redis.quit().catch(() => {});
  await sql.end({ timeout: 5 });
});
