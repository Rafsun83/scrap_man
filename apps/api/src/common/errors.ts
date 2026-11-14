import { HttpStatus } from '@nestjs/common';

/** Error codes from docs/openapi.yaml (components.schemas.Error). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'OTP_INVALID'
  | 'OTP_RATE_LIMIT'
  | 'NOT_APPROVED'
  | 'ALREADY_TAKEN'
  | 'INVALID_STATE'
  | 'TRX_ID_REUSED'
  | 'BELOW_MINIMUM'
  | 'OUT_OF_RANGE'
  | 'CODE_MISMATCH'
  | 'CODE_LOCKED'
  | 'SCALE_PHOTO_REQUIRED'
  | 'TRX_ID_REQUIRED'
  | 'NOT_FOUND'
  | 'FORBIDDEN';

/** Throw this from services; the global filter turns it into `{ code, message, details }`. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: HttpStatus,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, message, details);
  }
  static unauthorized(message = 'Sign in again: the access token is missing or expired.') {
    return new AppError('UNAUTHORIZED', HttpStatus.UNAUTHORIZED, message);
  }
  static forbidden(message: string) {
    return new AppError('FORBIDDEN', HttpStatus.FORBIDDEN, message);
  }
  static notFound(message: string) {
    return new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, message);
  }
}
