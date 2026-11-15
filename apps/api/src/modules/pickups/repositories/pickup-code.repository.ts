import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module.js';

const codeKey = (pickupId: string) => `bw:pcode:${pickupId}`;

/** The plain pickup code, kept in Redis so the household can see it again; the database has only the hash. */
@Injectable()
export class PickupCodeRepository {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async save(pickupId: string, code: string, ttlSec: number): Promise<void> {
    await this.redis.set(codeKey(pickupId), code, 'EX', ttlSec);
  }

  find(pickupId: string): Promise<string | null> {
    return this.redis.get(codeKey(pickupId));
  }

  async delete(pickupId: string): Promise<void> {
    await this.redis.del(codeKey(pickupId));
  }
}
