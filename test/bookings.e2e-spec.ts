/**
 * Mandatory e2e suite — runs against REAL PostgreSQL (Neon), never mocks.
 *
 * Test DB setup (repeatable):
 *   1. Create a SEPARATE Neon database/branch for tests.
 *   2. TEST_DATABASE_URL="postgresql://.../neondb_test?sslmode=require"
 *   3. npx prisma migrate deploy        # creates tables + partial unique index
 *   4. npm run test:e2e
 *
 * The suite points Prisma at TEST_DATABASE_URL (falls back to DATABASE_URL
 * only if the former is unset), wipes `bookings` before each test and
 * re-seeds three fixed slots, so every run starts identical.
 *
 * Covered:
 * 1. 201 booking removes the slot from GET /slots.
 * 2. Two OVERLAPPING requests for the same slot -> exactly one 201 + one 409
 *    (sent concurrently via Promise.all, not sequentially), one active row kept.
 * 3. DELETE 200 re-lists the slot and allows a fresh booking.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/bootstrap.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Use the test database BEFORE the app (and PrismaService) is created.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const SLOT_A = '11111111-1111-4111-8111-111111111111';
const SLOT_B = '33333333-3333-4333-8333-333333333333';
const SLOT_C = '55555555-5555-4555-8555-555555555555';

const TEST_SLOTS = [
  {
    id: SLOT_A,
    startsAt: new Date('2030-01-15T09:00:00.000Z'),
    endsAt: new Date('2030-01-15T09:30:00.000Z'),
  },
  {
    id: SLOT_B,
    startsAt: new Date('2030-01-15T09:30:00.000Z'),
    endsAt: new Date('2030-01-15T10:00:00.000Z'),
  },
  {
    id: SLOT_C,
    startsAt: new Date('2030-01-15T10:00:00.000Z'),
    endsAt: new Date('2030-01-15T10:30:00.000Z'),
  },
];

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

async function resetDb() {
  await prisma.booking.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.slot.createMany({ data: TEST_SLOTS });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL/TEST_DATABASE_URL is not set. See README "Test database setup".',
    );
  }
  const created = await createApp();
  app = created.app;
  await app.init();
  prisma = app.get(PrismaService);
  await resetDb();
  http = request(app.getHttpServer());
}, 120_000);

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await app?.close();
});

describe('Appointment booking API (real Postgres)', () => {
  it('1. books with 201 and hides the slot from GET /slots', async () => {
    const create = await http.post('/bookings').send({
      slotId: SLOT_A,
      customerName: 'Alex Morgan',
      customerEmail: 'alex@example.com',
    });

    expect(create.status).toBe(201);
    expect(create.body.booking).toMatchObject({
      slotId: SLOT_A,
      customerName: 'Alex Morgan',
      customerEmail: 'alex@example.com',
      status: 'active',
    });
    expect(create.body.booking.id).toBeDefined();

    const slots = await http.get('/slots');
    expect(slots.status).toBe(200);
    const ids = (slots.body.slots as { id: string }[]).map((s) => s.id);
    expect(ids).not.toContain(SLOT_A);
    // Still sorted ascending by startsAt then id.
    expect(ids).toEqual([...ids].sort());
  });

  it('2. overlapping requests for one slot -> one 201 + one 409, single active row', async () => {
    // Fire BOTH requests without awaiting in between: they overlap inside
    // the server/DB. Sequential awaits would NOT prove race-safety.
    const payloadA = {
      slotId: SLOT_B,
      customerName: 'Racer One',
      customerEmail: 'one@example.com',
    };
    const payloadB = {
      slotId: SLOT_B,
      customerName: 'Racer Two',
      customerEmail: 'two@example.com',
    };
    const [r1, r2] = await Promise.all([
      http.post('/bookings').send(payloadA),
      http.post('/bookings').send(payloadB),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const loser = r1.status === 409 ? r1 : r2;
    expect(loser.body).toEqual({
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: expect.any(String),
      },
    });

    // Exactly one ACTIVE booking survived — history has no duplicates.
    const activeCount = await prisma.booking.count({
      where: { slotId: SLOT_B, status: 'active' },
    });
    expect(activeCount).toBe(1);
  });

  it('3. DELETE 200 re-lists the slot and allows a new booking', async () => {
    const first = await http.post('/bookings').send({
      slotId: SLOT_C,
      customerName: 'Alex Morgan',
      customerEmail: 'alex@example.com',
    });
    expect(first.status).toBe(201);
    const bookingId = first.body.booking.id as string;

    const cancel = await http.delete(`/bookings/${bookingId}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.booking).toMatchObject({ id: bookingId, status: 'cancelled' });

    // Slot visible again…
    const slots = await http.get('/slots');
    expect(slots.status).toBe(200);
    expect(slots.body.slots.map((s: { id: string }) => s.id)).toContain(SLOT_C);

    // …and re-bookable.
    const second = await http.post('/bookings').send({
      slotId: SLOT_C,
      customerName: 'New Customer',
      customerEmail: 'new@example.com',
    });
    expect(second.status).toBe(201);
    expect(second.body.booking.status).toBe('active');

    // Repeat-cancel of the OLD (already-cancelled) booking: 200, unchanged,
    // and must not disturb the NEW active booking.
    const repeat = await http.delete(`/bookings/${bookingId}`);
    expect(repeat.status).toBe(200);
    expect(repeat.body.booking.status).toBe('cancelled');
    const activeCount = await prisma.booking.count({
      where: { slotId: SLOT_C, status: 'active' },
    });
    expect(activeCount).toBe(1);
  });
});
