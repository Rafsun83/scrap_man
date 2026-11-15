import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import type { Role } from '@bw/shared';
import { AppError } from '../../../common/errors.js';
import type { Env } from '../../../config/env.js';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';

export interface AccessPayload {
  sub: string;
  role: Role;
}

/** Access JWTs and rotating refresh tokens. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** A short-lived JWT for API calls and a rotating refresh token kept (hashed) in Redis. */
  async issue(user: { id: string; role: Role }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const expiresIn = this.config.get('ACCESS_TOKEN_TTL_SEC', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role } satisfies AccessPayload, {
      expiresIn,
    });
    const refreshToken = randomBytes(32).toString('base64url');
    const ttlSec = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400;
    await this.refreshTokenRepository.save(refreshToken, user.id, ttlSec);
    return { accessToken, refreshToken, expiresIn };
  }

  /** Uses up a refresh token and returns its user id; each token works once. */
  async consumeRefresh(refreshToken: string): Promise<string> {
    const userId = await this.refreshTokenRepository.take(refreshToken);
    if (!userId) throw AppError.unauthorized('The session has ended. Sign in again.');
    return userId;
  }

  revoke(refreshToken: string): Promise<void> {
    return this.refreshTokenRepository.delete(refreshToken);
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    try {
      return await this.jwt.verifyAsync<AccessPayload>(token);
    } catch {
      throw AppError.unauthorized();
    }
  }
}
