import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module.js';

/** Round trips to the database and Redis; health checks only. */
@Injectable()
export class HealthRepository {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async pingDatabase(): Promise<void> {
    await this.dataSource.query('SELECT 1');
  }

  pingRedis(): Promise<string> {
    return this.redis.ping();
  }
}
