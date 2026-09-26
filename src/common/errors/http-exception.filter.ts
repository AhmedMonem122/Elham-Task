/**
 * Global exception filter — guarantees EVERY error response has the shape:
 *   { "error": { "code": "<SPEC_CODE>", "message": "<clear text>" } }
 *
 * Mapping:
 * - DomainError            -> its own code + status
 * - Prisma P2002 (unique)  -> 409 SLOT_UNAVAILABLE (race safety net)
 * - Prisma P2025 (not found)-> 404 (slot/booking, best-effort)
 * - Nest 400 BadRequest    -> 400 VALIDATION_ERROR
 *   (covers ValidationPipe failures, invalid JSON bodies, ParseUUIDPipe)
 * - Nest 404 NotFound      -> 404 NOT_FOUND (unknown route)
 * - anything else          -> 500 INTERNAL_ERROR, message sanitised
 *   (never leaks stack traces or DB internals)
 */
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from './domain.error.js';

function isPrismaError(
  err: unknown,
): err is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

function validationMessageFromBadRequest(exc: BadRequestException): string {
  const body = exc.getResponse() as unknown;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const raw = (body as { message: unknown }).message;
    if (Array.isArray(raw)) {
      const first = raw.filter((m) => typeof m === 'string').join('; ');
      if (first) return first;
    }
    if (typeof raw === 'string' && raw.trim()) return raw;
  }
  const fallback =
    typeof exc.message === 'string' && exc.message.trim()
      ? exc.message
      : 'Invalid request.';
  return fallback;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // 1) Our own domain errors — already shaped correctly.
    if (exception instanceof DomainError) {
      res
        .status(exception.status)
        .json({ error: { code: exception.code, message: exception.message } });
      return;
    }

    // 2) Prisma safety net: unique violation on the partial index means
    //    a concurrent booking won the race -> 409, not 500.
    if (isPrismaError(exception) && exception.code === 'P2002') {
      res.status(HttpStatus.CONFLICT).json({
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'This slot already has an active booking.',
        },
      });
      return;
    }
    if (isPrismaError(exception) && exception.code === 'P2025') {
      res.status(HttpStatus.NOT_FOUND).json({
        error: { code: 'NOT_FOUND', message: 'Requested resource not found.' },
      });
      return;
    }

    // 3) Nest HTTP errors.
    if (exception instanceof BadRequestException) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: validationMessageFromBadRequest(exception),
        },
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === HttpStatus.NOT_FOUND) {
        res.status(status).json({
          error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found.`,
          },
        });
        return;
      }
      // Any other 4xx from Nest is a client error -> validation-shaped.
      if (status >= 400 && status < 500) {
        res.status(status).json({
          error: {
            code: 'VALIDATION_ERROR',
            message:
              exception.message?.trim() ||
              'The request could not be understood.',
          },
        });
        return;
      }
    }

    // 4) Invalid JSON body: body-parser raises a bare SyntaxError with
    //    `status === 400` and `type === 'entity.parse.failed'`.
    const maybeParseError = exception as {
      status?: unknown;
      type?: unknown;
      message?: unknown;
    };
    if (
      exception instanceof SyntaxError ||
      (typeof maybeParseError?.status === 'number' &&
        maybeParseError.status === 400)
    ) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Malformed JSON body. Send valid JSON.',
        },
      });
      return;
    }

    // 5) Everything else -> 500, sanitised. Log the real error server-side.
    this.logger.error(
      `Unhandled ${req.method} ${req.path}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
    });
  }
}
