import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { DomainError } from '../common/errors/domain.error.js';
import { cleanText, newId } from '../common/utils/ids-text.util.js';

export interface BookingRow {
  id: string;
  slotId: string;
  customerName: string;
  customerEmail: string;
  status: 'active' | 'cancelled';
}

function toRow(b: {
  id: string;
  slotId: string;
  customerName: string;
  customerEmail: string;
  status: string;
}): BookingRow {
  return {
    id: b.id,
    slotId: b.slotId,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    status: b.status as BookingRow['status'],
  };
}

/**
 * Booking write model.
 *
 * CONCURRENCY STRATEGY (defence in depth, 2 layers):
 * 1) Row lock: inside a transaction, `SELECT ... FOR UPDATE` on the slot
 *    serialises concurrent bookers of the SAME slot — the loser waits,
 *    then sees the winner's committed active booking and gets 409.
 * 2) Partial unique index `bookings_active_slot_unique(slot_id)
 *    WHERE status='active'`: even if the app check were bypassed, Postgres
 *    itself rejects a second active booking (P2002 -> mapped to 409).
 *
 * Socket events are emitted AFTER the transaction commits, exactly once
 * per state change (no event on rejections or idempotent repeat cancels).
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(
    slotId: string,
    customerName: string,
    customerEmail: string,
  ): Promise<BookingRow> {
    const name = cleanText(customerName);
    const email = cleanText(customerEmail);

    let created!: BookingRow;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // Layer 1 — serialise racers on this slot row.
        const locked: { id: string }[] = await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "slots" WHERE id = ${slotId}::uuid FOR UPDATE`,
        );
        if (locked.length === 0) throw DomainError.slotNotFound(slotId);

        const clash = await tx.booking.findFirst({
          where: { slotId, status: 'active' },
          select: { id: true },
        });
        if (clash) throw DomainError.slotUnavailable();

        // Layer 2 — the partial unique index below turns any residual
        // race into P2002, mapped to 409 by the global filter.
        const row = await tx.booking.create({
          data: {
            id: newId(),
            slotId,
            customerName: name,
            customerEmail: email,
            status: 'active',
          },
        });
        return toRow(row);
      });
    } catch (err) {
      if (err instanceof DomainError) throw err;
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
      ) {
        throw DomainError.slotUnavailable();
      }
      throw err;
    }

    // Emit only after a committed 201.
    this.realtime.emitBooked(created.slotId, created.id);
    return created;
  }

  /**
   * Idempotent, race-safe cancel.
   *
   * A single atomic `updateMany({ where: { id, status: 'active' } })` flips
   * at most one row: concurrent duplicate cancels collapse into one winner
   * (emits `slot.released`) while losers simply re-read the cancelled row
   * with NO extra event. Repeat-cancel returns 200 with the unchanged row,
   * and touching an old cancelled booking never affects a newer active
   * booking on the same slot — only the row with this id is ever updated.
   */
  async cancel(bookingId: string): Promise<BookingRow> {
    const flipped = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'active' },
      data: { status: 'cancelled' },
    });

    if (flipped.count === 1) {
      const row = await this.prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
      });
      const out = toRow(row);
      this.realtime.emitReleased(out.slotId, out.id);
      return out;
    }

    const existing = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!existing) throw DomainError.bookingNotFound(bookingId);
    return toRow(existing); // already cancelled -> same payload, no event
  }
}
