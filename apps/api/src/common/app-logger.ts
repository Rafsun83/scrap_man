import { ConsoleLogger } from '@nestjs/common';
import { requestContext } from './request-context.js';

/**
 * Nest's console logger; in JSON mode every line also carries the request id and user id of the request
 * being handled, so one request's lines can be found together (X-Request-Id).
 */
export class AppLogger extends ConsoleLogger {
  protected override getJsonLogObject(message: unknown, options: Parameters<ConsoleLogger['getJsonLogObject']>[1]) {
    const object = super.getJsonLogObject(message, options) as Record<string, unknown>;
    const ctx = requestContext.get();
    if (ctx) {
      object.requestId = ctx.requestId;
      if (ctx.userId) object.userId = ctx.userId;
    }
    return object as ReturnType<ConsoleLogger['getJsonLogObject']>;
  }
}

/** JSON logs in production (or LOG_FORMAT=json), readable text otherwise. */
export function createAppLogger(env: NodeJS.ProcessEnv = process.env): AppLogger {
  const json = env.LOG_FORMAT ? env.LOG_FORMAT === 'json' : env.NODE_ENV === 'production';
  return new AppLogger({ json, colors: !json, logLevels: env.NODE_ENV === 'test' ? ['error', 'warn'] : undefined });
}
