import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AvailableSlot {
  id: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Read model: a slot is available <=> zero ACTIVE bookings reference it.
 * Sorted by startsAt ASC, then id ASC per spec.
 */
@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAvailable(): Promise<AvailableSlot[]> {
    const rows = await this.prisma.slot.findMany({
      where: { bookings: { none: { status: 'active' } } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: { id: true, startsAt: true, endsAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    }));
  }
}
