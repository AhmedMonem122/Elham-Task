/**
 * Fixed pre-seeded slots.
 *
 * Run:  npx prisma migrate deploy && npm run db:seed
 *
 * Idempotent: uses upsert on the fixed UUIDs, so re-running is safe.
 * All timestamps are ISO-8601 UTC, endsAt > startsAt.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

/** Deterministic v4-shaped UUIDs so tests/docs can reference them. */
const SLOTS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    startsAt: '2030-01-15T09:00:00.000Z',
    endsAt: '2030-01-15T09:30:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    startsAt: '2030-01-15T09:30:00.000Z',
    endsAt: '2030-01-15T10:00:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    startsAt: '2030-01-15T10:00:00.000Z',
    endsAt: '2030-01-15T10:30:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    startsAt: '2030-01-15T10:30:00.000Z',
    endsAt: '2030-01-15T11:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    startsAt: '2030-01-15T11:00:00.000Z',
    endsAt: '2030-01-15T11:30:00.000Z',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    startsAt: '2030-01-15T11:30:00.000Z',
    endsAt: '2030-01-15T12:00:00.000Z',
  },
] as const;

async function main() {
  for (const slot of SLOTS) {
    await prisma.slot.upsert({
      where: { id: slot.id },
      update: {
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
      },
      create: {
        id: slot.id,
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
      },
    });
  }
  const count = await prisma.slot.count();
  console.log(`Seed OK: ${count} slot(s) present (${SLOTS.length} fixed).`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
