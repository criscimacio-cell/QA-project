import { defineConfig } from 'vitest/config';

// Tests hit a real Postgres/Redis (this codebase's own convention — see
// ARCHITECTURE.md, there's no SQLite/mock layer). DATABASE_URL/REDIS_URL
// below point at dedicated test instances so a test run never touches dev
// data; override via the environment (e.g. in CI) if those defaults don't
// fit. Values are injected directly into process.env by vitest itself
// (not via dotenv), so they're visible before any app module is imported —
// sidesteps the dotenv-vs-import-hoisting ordering issue that affects
// eager top-level `process.env.X` reads (see db.ts, redis.ts) under tsx/esbuild.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 30000,
    // Explicit, not just relying on tsconfig excluding dist/ from the build —
    // a stray compiled dist/__tests__/*.test.js (CJS) can't be imported by
    // vitest and would otherwise get picked up by the default test glob.
    include: ['src/__tests__/**/*.test.ts'],
    // Tests share one real Postgres/Redis and don't run in per-test
    // transactions, so files must not run concurrently against it.
    fileParallelism: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-jwt-secret-do-not-use-in-production-aaaaaaaa',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://qtamp:qtamp_dev@localhost:5432/qtamp_test',
      // Logical DB 1, not 0 — so flushing test state can't wipe a dev server's
      // BullMQ queue/cache data if both happen to point at the same Redis host.
      REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
      UPLOAD_DIR: './.test-uploads',
      BACKUP_DIR: './.test-backups',
      FILE_ENCRYPTION_KEY: '11'.repeat(32),
      ALLOWED_ORIGINS: 'http://localhost:5173',
    },
  },
});
