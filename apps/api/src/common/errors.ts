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
  static invalidState(message: string, details?: Record<string, unknown>) {
    return new AppError('INVALID_STATE', HttpStatus.CONFLICT, message, details);
  }
  static alreadyTaken() {
    return new AppError('ALREADY_TAKEN', HttpStatus.CONFLICT, 'Another collector accepted this request first. Pick another one.');
  }
  static notApproved() {
    return new AppError(
      'NOT_APPROVED',
      HttpStatus.FORBIDDEN,
      'Your collector account is not approved yet. You can take requests once an admin approves it.',
    );
  }
  static outOfRange(message: string, details?: Record<string, unknown>) {
    return new AppError('OUT_OF_RANGE', HttpStatus.UNPROCESSABLE_ENTITY, message, details);
  }
  static codeMismatch(attemptsLeft: number) {
    return new AppError(
      'CODE_MISMATCH',
      HttpStatus.UNPROCESSABLE_ENTITY,
      `That pickup code is wrong. Ask the household for the 4-digit code; ${attemptsLeft} tries left.`,
      { attemptsLeft },
    );
  }
  static codeLocked() {
    return new AppError(
      'CODE_LOCKED',
      HttpStatus.LOCKED,
      'Too many wrong pickup codes: this pickup is locked. BhangariWala support has been told and will contact you.',
    );
  }
  static belowMinimum(message: string) {
    return new AppError('BELOW_MINIMUM', HttpStatus.UNPROCESSABLE_ENTITY, message);
  }
  static scalePhotoRequired(message = 'Take a photo of the scale and upload it before sending the weights.') {
    return new AppError('SCALE_PHOTO_REQUIRED', HttpStatus.UNPROCESSABLE_ENTITY, message);
  }
  static trxIdRequired() {
    return new AppError(
      'TRX_ID_REQUIRED',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Enter the TrxID from the bKash or Nagad message you got after sending the money.',
    );
  }
  static trxIdReused() {
    return new AppError(
      'TRX_ID_REUSED',
      HttpStatus.CONFLICT,
      'This TrxID was already used for another payment. Check the message and enter the TrxID for this payment.',
    );
  }
}

/** True when a database error is a unique-constraint violation, optionally on one constraint or index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.driverError?.code;
  const name = e?.constraint ?? e?.driverError?.constraint;
  return code === '23505' && (constraint === undefined || name === constraint);
}
