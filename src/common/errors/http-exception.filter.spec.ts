import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from './domain.error.js';
import { GlobalExceptionFilter } from './http-exception.filter.js';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json };
  const req = { method: 'POST', path: '/bookings' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as any;
  return { host, res, status, json };
}

describe('GlobalExceptionFilter envelope', () => {
  it('passes DomainError code/status through', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(DomainError.slotUnavailable(), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: expect.any(String),
      },
    });
  });

  it('maps BadRequest (validation pipe / bad JSON / bad UUID) to VALIDATION_ERROR', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(
      new BadRequestException('customerEmail must be a valid email address.'),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
    });
  });

  it('maps Prisma P2002 (partial-unique race) to 409 SLOT_UNAVAILABLE', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch({ code: 'P2002' }, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'SLOT_UNAVAILABLE', message: expect.any(String) },
    });
  });

  it('sanitises unexpected errors as INTERNAL_ERROR without leaking internals', () => {
    const { host, status, json } = mockHost();
    new GlobalExceptionFilter().catch(
      new Error('secret: password=xyz, select * from bookings'),
      host,
    );
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('password');
    expect(body.error.message).not.toContain('select');
  });
});
