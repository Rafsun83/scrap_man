import { defineConfig } from 'vitest/config';

// Local runs read apps/api/.env; CI passes variables directly.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file
}

// Point the app at the test database and Redis db, never the development ones.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
process.env.NODE_ENV = 'test';
delete process.env.OTP_DEV_CODE; // tests use real random codes
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters-long';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1);
if (!dbName.endsWith('_test') && process.env.CI !== 'true') {
  throw new Error(
    `E2E tests wipe their database, so its name must end in "_test" (got "${dbName}"). Set TEST_DATABASE_URL.`,
  );
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false, // files share one database
    hookTimeout: 30_000,
  },
});
