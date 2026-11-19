export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  ACCESS_TOKEN_TTL_SEC: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  OTP_TTL_SEC: number;
  /** Development only: every OTP is this code, so testers can sign in without SMS. */
  OTP_DEV_CODE?: string;
  /** Run the matching jobs (radius widening, expiry) in this process. Tests turn them off. */
  JOBS_ENABLED: boolean;
  /** S3-compatible photo storage; SeaweedFS locally. */
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
  /** Create the photo bucket on start if missing: on in development, opt-in elsewhere (a self-hosted stack). */
  S3_CREATE_BUCKET: boolean;
  /**
   * Where SMS go: `console` (the API log; development) or `http` (a gateway that takes a JSON POST). Production
   * defaults to `http`; choosing console there must be explicit.
   */
  SMS_PROVIDER: 'console' | 'http';
  SMS_HTTP_URL?: string;
  SMS_HTTP_API_KEY?: string;
  SMS_SENDER_ID?: string;
  SMS_TIMEOUT_MS: number;
}

function bool(raw: unknown, name: string, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  throw new Error(`${name} must be true or false, got "${asText(raw)}".`);
}

/** Env values are strings; anything else is shown as JSON in error messages. */
const asText = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

function positiveInt(raw: unknown, name: string, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive whole number, got "${asText(raw)}".`);
  }
  return value;
}

/** Validates process env at startup so a missing setting fails fast with a clear message. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const missing = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'].filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to apps/api/.env.`);
  }
  const nodeEnv = (raw.NODE_ENV as string) ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be development, test or production, got "${nodeEnv}".`);
  }
  const jwtSecret = asText(raw.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }
  const devCode = raw.OTP_DEV_CODE ? asText(raw.OTP_DEV_CODE) : undefined;
  if (devCode && nodeEnv === 'production') {
    throw new Error('OTP_DEV_CODE must not be set in production.');
  }
  if (devCode && !/^[0-9]{6}$/.test(devCode)) {
    throw new Error('OTP_DEV_CODE must be 6 digits.');
  }
  const s3Missing = ['S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].filter((key) => !raw[key]);
  if (nodeEnv === 'production' && s3Missing.length > 0) {
    throw new Error(`Missing photo storage settings: ${s3Missing.join(', ')}.`);
  }
  const smsProvider = raw.SMS_PROVIDER ? asText(raw.SMS_PROVIDER) : nodeEnv === 'production' ? 'http' : 'console';
  if (smsProvider !== 'console' && smsProvider !== 'http') {
    throw new Error(`SMS_PROVIDER must be console or http, got "${smsProvider}".`);
  }
  const smsMissing = ['SMS_HTTP_URL', 'SMS_HTTP_API_KEY'].filter((key) => !raw[key]);
  if (smsProvider === 'http' && smsMissing.length > 0) {
    throw new Error(`SMS_PROVIDER=http needs ${smsMissing.join(' and ')}. Set them, or SMS_PROVIDER=console for local runs.`);
  }
  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: positiveInt(raw.PORT, 'PORT', 3000),
    DATABASE_URL: asText(raw.DATABASE_URL),
    REDIS_URL: asText(raw.REDIS_URL),
    JWT_SECRET: jwtSecret,
    ACCESS_TOKEN_TTL_SEC: positiveInt(raw.ACCESS_TOKEN_TTL_SEC, 'ACCESS_TOKEN_TTL_SEC', 900),
    REFRESH_TOKEN_TTL_DAYS: positiveInt(raw.REFRESH_TOKEN_TTL_DAYS, 'REFRESH_TOKEN_TTL_DAYS', 30),
    OTP_TTL_SEC: positiveInt(raw.OTP_TTL_SEC, 'OTP_TTL_SEC', 300),
    OTP_DEV_CODE: devCode,
    JOBS_ENABLED: bool(raw.JOBS_ENABLED, 'JOBS_ENABLED', true),
    // Development defaults match the s3 service in docker-compose.yml.
    S3_ENDPOINT: raw.S3_ENDPOINT ? asText(raw.S3_ENDPOINT) : nodeEnv === 'production' ? undefined : 'http://localhost:8333',
    S3_REGION: raw.S3_REGION ? asText(raw.S3_REGION) : 'us-east-1',
    S3_BUCKET: raw.S3_BUCKET ? asText(raw.S3_BUCKET) : 'bhangariwala-photos',
    S3_ACCESS_KEY: raw.S3_ACCESS_KEY ? asText(raw.S3_ACCESS_KEY) : 'bw_s3',
    S3_SECRET_KEY: raw.S3_SECRET_KEY ? asText(raw.S3_SECRET_KEY) : 'bw_s3_dev_password',
    S3_FORCE_PATH_STYLE: bool(raw.S3_FORCE_PATH_STYLE, 'S3_FORCE_PATH_STYLE', true),
    S3_CREATE_BUCKET: bool(raw.S3_CREATE_BUCKET, 'S3_CREATE_BUCKET', nodeEnv === 'development'),
    SMS_PROVIDER: smsProvider,
    SMS_HTTP_URL: raw.SMS_HTTP_URL ? asText(raw.SMS_HTTP_URL) : undefined,
    SMS_HTTP_API_KEY: raw.SMS_HTTP_API_KEY ? asText(raw.SMS_HTTP_API_KEY) : undefined,
    SMS_SENDER_ID: raw.SMS_SENDER_ID ? asText(raw.SMS_SENDER_ID) : undefined,
    SMS_TIMEOUT_MS: positiveInt(raw.SMS_TIMEOUT_MS, 'SMS_TIMEOUT_MS', 5000),
  };
}
