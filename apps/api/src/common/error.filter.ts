import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError, type ErrorCode } from './errors.js';

const BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

/** Every error leaves the API as `{ code, message, details }`, as the contract says. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (error instanceof AppError) {
      res.status(error.status).json({ code: error.code, message: error.message, details: error.details });
      return;
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      // Health checks return their report as the body of a 503; keep it as is.
      if (status === HttpStatus.SERVICE_UNAVAILABLE && typeof body === 'object') {
        res.status(status).json(body);
        return;
      }
      res.status(status).json({
        code: BY_STATUS[status] ?? 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }

    this.logger.error(error instanceof Error ? error.stack : String(error));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on the server. Try again; if it keeps happening, contact support.',
    });
  }
}
