import Redis from 'ioredis';
import { logger } from './logger';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 200, 3000),
});

redis.on('error', (err) => {
  if ((err as any).code !== 'ECONNREFUSED') logger.error({ err }, 'Redis error');
});

/** Cache helper — falls through silently if Redis is unavailable */
export async function getCached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {}

  const result = await fn();

  try {
    await redis.setex(key, ttl, JSON.stringify(result));
  } catch {}

  return result;
}

export async function invalidate(...keys: string[]) {
  try { await redis.del(...keys); } catch {}
}
