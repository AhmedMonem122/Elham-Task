-- Appointment booking API — initial migration.
-- Design: availability is DERIVED (slot has no active booking).
-- The partial unique index below is the last line of defence against
-- double booking: at most one 'active' booking per slot, enforced by
-- Postgres itself even if two transactions race past the app-level lock.

-- Enums
CREATE TYPE "booking_status" AS ENUM ('active', 'cancelled');

-- Tables
CREATE TABLE "slots" (
  "id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "slots_ends_after_starts" CHECK ("ends_at" > "starts_at")
);

CREATE TABLE "bookings" (
  "id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  "customer_name" TEXT NOT NULL,
  "customer_email" TEXT NOT NULL,
  "status" "booking_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Helpful lookup indexes
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- THE concurrency guarantee: Postgres rejects a second 'active' booking
-- for the same slot with a unique violation (mapped to 409 SLOT_UNAVAILABLE).
-- Cancelled rows are excluded, so history is kept and the slot can be rebooked.
CREATE UNIQUE INDEX "bookings_active_slot_unique" ON "bookings"("slot_id") WHERE status = 'active';
