import pino from 'pino';

// Structured JSON logs to stdout instead of free-text console output, so a
// container/host log collector can parse and filter by level/field directly.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
