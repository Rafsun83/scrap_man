import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Role } from '@bw/shared';
import { AppError } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { toUserDto, type UserEntity } from '../users/user.entity.js';

export interface AccessPayload {
  sub: string;
  role: Role;
}

const refreshKey = (token: string) => `bw:rt:${createHash('sha256').update(token).digest('hex')}`;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** A short-lived JWT for API calls and a rotating refresh token kept (hashed) in Redis. */
  async issue(user: UserEntity) {
    const expiresIn = this.config.get('ACCESS_TOKEN_TTL_SEC', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role } satisfies AccessPayload, {
      expiresIn,
    });
    const refreshToken = randomBytes(32).toString('base64url');
    const ttlSec = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400;
    await this.redis.set(refreshKey(refreshToken), user.id, 'EX', ttlSec);
    return { accessToken, refreshToken, expiresIn, user: toUserDto(user) };
  }

  /** Uses up a refresh token and returns its user id; each token works once. */
  async consumeRefresh(refreshToken: string): Promise<string> {
    const userId = await this.redis.getdel(refreshKey(refreshToken));
    if (!userId) throw AppError.unauthorized('The session has ended. Sign in again.');
    return userId;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.redis.del(refreshKey(refreshToken));
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    try {
      return await this.jwt.verifyAsync<AccessPayload>(token);
    } catch {
      throw AppError.unauthorized();
    }
  }
}
