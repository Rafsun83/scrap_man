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

  it('uses console SMS in development and needs a gateway in production', () => {
    expect(validateEnv(base).SMS_PROVIDER).toBe('console');
    const s3 = { S3_BUCKET: 'b', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's' };
    expect(() => validateEnv({ ...base, ...s3, NODE_ENV: 'production' })).toThrow('SMS_PROVIDER=http needs SMS_HTTP_URL and SMS_HTTP_API_KEY');
    expect(validateEnv({ ...base, ...s3, NODE_ENV: 'production', SMS_PROVIDER: 'console', PUSH_PROVIDER: 'console' }).SMS_PROVIDER).toBe('console');
    const http = validateEnv({ ...base, SMS_PROVIDER: 'http', SMS_HTTP_URL: 'https://sms', SMS_HTTP_API_KEY: 'k' });
    expect(http).toMatchObject({ SMS_PROVIDER: 'http', SMS_TIMEOUT_MS: 5000 });
    expect(() => validateEnv({ ...base, SMS_PROVIDER: 'pigeon' })).toThrow('console or http');
  });

  it('uses console push in development and needs Firebase credentials in production', () => {
    expect(validateEnv(base).PUSH_PROVIDER).toBe('console');
    const prod = { ...base, NODE_ENV: 'production', S3_BUCKET: 'b', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's', SMS_PROVIDER: 'console' };
    expect(() => validateEnv(prod)).toThrow('PUSH_PROVIDER=fcm needs FCM_SERVICE_ACCOUNT_JSON');
    expect(validateEnv({ ...prod, PUSH_PROVIDER: 'console' }).PUSH_PROVIDER).toBe('console');
    expect(validateEnv({ ...prod, GOOGLE_APPLICATION_CREDENTIALS: '/run/secrets/fcm.json' }).PUSH_PROVIDER).toBe('fcm');
    expect(validateEnv({ ...prod, FCM_PROJECT_ID: 'bw' }).FCM_PROJECT_ID).toBe('bw');
    expect(() => validateEnv({ ...base, PUSH_PROVIDER: 'apns' })).toThrow('console or fcm');
  });

  it('checks the Firebase key without echoing it', () => {
    const key = JSON.stringify({ project_id: 'bw', client_email: 'a@bw.iam.gserviceaccount.com', private_key: 'secret-pem' });
    expect(validateEnv({ ...base, PUSH_PROVIDER: 'fcm', FCM_SERVICE_ACCOUNT_JSON: key }).FCM_SERVICE_ACCOUNT_JSON).toBe(key);
    expect(() => validateEnv({ ...base, FCM_SERVICE_ACCOUNT_JSON: '{secret-pem' })).toThrow('not valid JSON');
    expect(() => validateEnv({ ...base, FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'bw', private_key: 'secret-pem' }) })).toThrow(
      'missing client_email',
    );
    try {
      validateEnv({ ...base, FCM_SERVICE_ACCOUNT_JSON: '{secret-pem' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-pem');
    }
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
