/**
 * Single source of truth for API error codes.
 * `message` text is free-form (must be clear + non-empty);
 * `code` must match the challenge spec exactly.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'SLOT_NOT_FOUND'
  | 'SLOT_UNAVAILABLE'
  | 'BOOKING_NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND';

/** Domain error thrown by services; the global filter maps it to JSON. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }

  static validation(message: string): DomainError {
    return new DomainError('VALIDATION_ERROR', message, 400);
  }

  static slotNotFound(id: string): DomainError {
    return new DomainError(
      'SLOT_NOT_FOUND',
      `No slot exists with id "${id}".`,
      404,
    );
  }

  static slotUnavailable(): DomainError {
    return new DomainError(
      'SLOT_UNAVAILABLE',
      'This slot already has an active booking.',
      409,
    );
  }

  static bookingNotFound(id: string): DomainError {
    return new DomainError(
      'BOOKING_NOT_FOUND',
      `No booking exists with id "${id}".`,
      404,
    );
  }
}
