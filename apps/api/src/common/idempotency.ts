import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { catchError, from, mergeMap, type Observable, of, throwError } from 'rxjs';
import { REDIS } from '../modules/redis/redis.module.js';
import { AppError } from './errors.js';

const IDEMPOTENT = 'bw:idempotent';
const TTL_SEC = 24 * 3600;

/** Marks a write that needs an Idempotency-Key header (see docs/version-0/openapi.yaml). */
export const Idempotent = () => SetMetadata(IDEMPOTENT, true);

interface Stored {
  state: 'pending' | 'done';
  hash: string;
  status?: number;
  body?: unknown;
}

/**
 * Repeating a call with the same Idempotency-Key (per user and URL, for 24 hours) returns the
 * first response without doing the work again. Failed calls are not remembered, so they can be retried.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.reflector.get<boolean>(IDEMPOTENT, ctx.getHandler())) return next.handle();
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { user?: { id: string } }>();
    const res = http.getResponse<Response>();

    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(key)) {
      throw AppError.validation(
        'Send an Idempotency-Key header: a new random value (up to 64 letters, digits, - or _) for each action.',
      );
    }
    const redisKey = `bw:idem:${req.user?.id ?? 'anon'}:${req.method}:${req.path}:${key}`;
    const hash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex');

    const claimed = await this.redis.set(redisKey, JSON.stringify({ state: 'pending', hash } satisfies Stored), 'EX', TTL_SEC, 'NX');
    if (!claimed) {
      const stored = JSON.parse((await this.redis.get(redisKey)) ?? 'null') as Stored | null;
      if (!stored || stored.state === 'pending') {
        throw AppError.invalidState('The same request is still being processed. Try again in a moment.');
      }
      if (stored.hash !== hash) {
        throw AppError.validation('This Idempotency-Key was already used with different data. Use a new key for a new action.');
      }
      res.status(stored.status ?? HttpStatus.OK);
      return of(stored.body);
    }

    const status =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, ctx.getHandler()) ??
      (req.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);
    return next.handle().pipe(
      mergeMap((body: unknown) =>
        from(
          this.redis.set(redisKey, JSON.stringify({ state: 'done', hash, status, body } satisfies Stored), 'EX', TTL_SEC),
        ).pipe(mergeMap(() => of(body))),
      ),
      catchError((error: unknown) => from(this.redis.del(redisKey)).pipe(mergeMap(() => throwError(() => error)))),
    );
  }
}
