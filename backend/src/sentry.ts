import * as Sentry from '@sentry/node';
import { logger } from './logger';

let initialized = false;

// Called explicitly from index.ts's bootstrap — NOT run as a bare top-level
// Sentry.init() in this module. Under tsx's dev transform, imports are
// evaluated before dotenv.config() runs (same class of issue fixed in
// auth.ts's sessionAbsoluteMaxMs() this session), so a top-level init() here
// could silently capture an empty GLITCHTIP_DSN if it's only set via .env.
// Calling this as an explicit function from index.ts, after `import app`
// has already resolved (and with it, app.ts's dotenv.config() calls), avoids
// that entirely.
export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.GLITCHTIP_DSN;
  Sentry.init({
    dsn: dsn || undefined,
    environment: process.env.NODE_ENV || 'development',
    // Error tracking only — no performance/APM tracing.
    tracesSampleRate: 0,
  });
  if (!dsn) {
    logger.info('GLITCHTIP_DSN not set — error tracking disabled (errors are still written to logs)');
  }
}

export { Sentry };
