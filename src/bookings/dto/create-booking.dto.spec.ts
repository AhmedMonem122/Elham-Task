import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateBookingDto } from './create-booking.dto.js';

async function messagesOf(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateBookingDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateBookingDto validation', () => {
  it('accepts valid input and trims name/email before validation', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      slotId: '11111111-1111-4111-8111-111111111111',
      customerName: '  Alex Morgan  ',
      customerEmail: '  alex@example.com ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.customerName).toBe('Alex Morgan');
    expect(dto.customerEmail).toBe('alex@example.com');
  });

  it('rejects missing/invalid fields', async () => {
    expect(await messagesOf({})).not.toHaveLength(0);
    expect(
      await messagesOf({
        slotId: 'not-a-uuid',
        customerName: 'Alex',
        customerEmail: 'alex@example.com',
      }),
    ).not.toHaveLength(0);
    expect(
      await messagesOf({
        slotId: '11111111-1111-4111-8111-111111111111',
        customerName: '   ',
        customerEmail: 'alex@example.com',
      }),
    ).not.toHaveLength(0);
    expect(
      await messagesOf({
        slotId: '11111111-1111-4111-8111-111111111111',
        customerName: 'Alex',
        customerEmail: 'not-an-email',
      }),
    ).not.toHaveLength(0);
  });
});
