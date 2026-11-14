export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
}

/** Validates process env at startup so a missing setting fails fast with a clear message. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const missing = ['DATABASE_URL', 'REDIS_URL'].filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to apps/api/.env.`);
  }
  const nodeEnv = (raw.NODE_ENV as string) ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be development, test or production, got "${nodeEnv}".`);
  }
  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive whole number, got "${String(raw.PORT)}".`);
  }
  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    DATABASE_URL: String(raw.DATABASE_URL),
    REDIS_URL: String(raw.REDIS_URL),
  };
}
