import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module.js';

const refreshKey = (token: string) => `bw:rt:${createHash('sha256').update(token).digest('hex')}`;

/** Refresh tokens, stored hashed in Redis with their user id. */
@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async save(token: string, userId: string, ttlSec: number): Promise<void> {
    await this.redis.set(refreshKey(token), userId, 'EX', ttlSec);
  }

  /** Reads and deletes in one step; null when the token is unknown or used. */
  take(token: string): Promise<string | null> {
    return this.redis.getdel(refreshKey(token));
  }

  async delete(token: string): Promise<void> {
    await this.redis.del(refreshKey(token));
  }
}
