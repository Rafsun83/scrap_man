import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module.js';

export interface StoredOtp {
  hash: string;
  attempts: number;
}

const otpKey = (phone: string) => `bw:otp:${phone}`;

/** OTPs and their request counters, in Redis. */
@Injectable()
export class OtpRepository {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Adds one to a fixed-window counter and returns the new count. */
  async countRequest(key: string, windowSec: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSec);
    return count;
  }

  /** Seconds left in a counter's window. */
  secondsLeft(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async save(phone: string, otp: StoredOtp, ttlSec: number): Promise<void> {
    await this.redis.set(otpKey(phone), JSON.stringify(otp), 'EX', ttlSec);
  }

  async find(phone: string): Promise<StoredOtp | null> {
    const raw = await this.redis.get(otpKey(phone));
    return raw ? (JSON.parse(raw) as StoredOtp) : null;
  }

  /** Updates the stored OTP without changing when it expires. */
  async update(phone: string, otp: StoredOtp): Promise<void> {
    await this.redis.set(otpKey(phone), JSON.stringify(otp), 'KEEPTTL');
  }

  async delete(phone: string): Promise<void> {
    await this.redis.del(otpKey(phone));
  }
}
