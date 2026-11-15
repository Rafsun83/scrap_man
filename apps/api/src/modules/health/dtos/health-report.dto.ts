export type CheckStateDto = 'up' | 'down';

/** GET /health: the database and Redis, each up or down. */
export interface HealthReportDto {
  status: 'ok' | 'degraded';
  checks: { database: CheckStateDto; redis: CheckStateDto };
  time: string;
}
