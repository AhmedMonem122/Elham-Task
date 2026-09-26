import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Thin wrapper over PrismaClient with Nest lifecycle hooks.
 * Uses the `pg` driver adapter (required by Prisma 7) and DATABASE_URL.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and fill it in.',
      );
    }
    super({ adapter: new PrismaPg({ connectionString: url }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Wipe bookings + restore fixed slots — used by e2e tests for repeatability. */
  async resetForTests(seedSlots: { id: string; startsAt: Date; endsAt: Date }[]) {
    await this.booking.deleteMany();
    await this.slot.deleteMany();
    await this.slot.createMany({ data: seedSlots });
  }
}
