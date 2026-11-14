import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

export type CheckState = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: { database: CheckState; redis: CheckState };
  time: string;
}

const TIMEOUT_MS = 1500;

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      withTimeout(this.dataSource.query('SELECT 1')).then(
        (): CheckState => 'up',
        (): CheckState => 'down',
      ),
      withTimeout(this.redis.ping()).then(
        (reply): CheckState => (reply === 'PONG' ? 'up' : 'down'),
        (): CheckState => 'down',
      ),
    ]);
    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      checks: { database, redis },
      time: new Date().toISOString(),
    };
  }
}
