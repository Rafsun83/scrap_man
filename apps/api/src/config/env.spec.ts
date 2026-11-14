import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgres://x',
    REDIS_URL: 'redis://x',
    JWT_SECRET: 'a-very-long-secret-of-at-least-32-chars',
  };

  it('fills defaults', () => {
    expect(validateEnv(base)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      ACCESS_TOKEN_TTL_SEC: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      OTP_TTL_SEC: 300,
      JOBS_ENABLED: true,
      S3_ENDPOINT: 'http://localhost:8333',
      S3_BUCKET: 'bhangariwala-photos',
    });
  });

  it('reads JOBS_ENABLED and rejects other words', () => {
    expect(validateEnv({ ...base, JOBS_ENABLED: 'false' }).JOBS_ENABLED).toBe(false);
    expect(() => validateEnv({ ...base, JOBS_ENABLED: 'no' })).toThrow('true or false');
  });

  it('needs real photo storage settings in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow('S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY');
  });

  it('names every missing variable', () => {
    expect(() => validateEnv({})).toThrow('DATABASE_URL, REDIS_URL, JWT_SECRET');
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow('at least 32');
  });

  it('refuses a dev OTP code in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', OTP_DEV_CODE: '123456' })).toThrow(
      'production',
    );
  });

  it('rejects a bad port', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
});
