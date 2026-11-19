import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;
const logger = new Logger('Http');

/**
 * Gives every request an id (the client's X-Request-Id when it is valid, otherwise a new one), echoes it
 * on the response, runs the request inside that context, and writes one access line when it ends.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const given = req.header('x-request-id');
  const requestId = given && VALID_ID.test(given) ? given : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const started = process.hrtime.bigint();
  requestContext.run({ requestId }, () => {
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const line = { msg: 'request', method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms * 10) / 10 };
      if (req.path.endsWith('/health')) logger.debug(line);
      else if (res.statusCode >= 500) logger.error(line);
      else logger.log(line);
    });
    next();
  });
}
