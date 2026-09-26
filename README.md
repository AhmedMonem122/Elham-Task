# Appointment Booking API (NestJS · PostgreSQL · Prisma · Socket.IO)

Mini booking API built for the hiring challenge: fixed pre-seeded slots, exactly one **active**
booking per slot (race-safe), idempotent cancel, realtime updates over Socket.IO, OpenAPI docs,
and automated tests against real PostgreSQL.

- `GET /slots` → available slots only (`{"slots":[...]}`), sorted by `startsAt` then `id`
- `POST /bookings` → `201` created / `400` / `404 SLOT_NOT_FOUND` / `409 SLOT_UNAVAILABLE`
- `DELETE /bookings/:bookingId` → `200` (idempotent cancel) / `400` / `404 BOOKING_NOT_FOUND`
- `GET /docs` → Swagger UI · `GET /openapi.json` → raw OpenAPI spec
- Socket.IO (same server, `/socket.io`, namespace `/`): `slot.booked` / `slot.released`
- All errors shaped `{ "error": { "code": "<SPEC_CODE>", "message": "<clear text>" } }`

## 1. Requirements

- Node.js 22+, npm 10+
- A PostgreSQL database — [Neon](https://neon.tech) recommended (pooled connection string,
  `?sslmode=require`). A **second, separate** database/branch for tests (tests wipe it).

## 2. Install

```bash
npm install
npx prisma generate
```

## 3. Environment variables

Copy `.env.example` to `.env` and fill in (never commit `.env`):

| Variable            | Required | What to put |
|---------------------|----------|-------------|
| `DATABASE_URL`      | yes      | Neon **pooled** connection string for the app DB, e.g. `postgresql://USER:PASSWORD@ep-xxxx.neon.tech/neondb?sslmode=require` |
| `TEST_DATABASE_URL` | for e2e  | Connection string of a **separate** test DB/branch (tests `deleteMany` + reseed it). Falls back to `DATABASE_URL` if unset — not recommended. |
| `PORT`              | no       | Local port, default `3000`. Vercel injects its own. |

On Vercel set the same variables in **Project → Settings → Environment Variables**
(`DATABASE_URL` required; `TEST_DATABASE_URL` not needed in production).

## 4. Database: migrate + seed

```bash
npx prisma migrate deploy   # creates tables + the partial unique index
npm run db:seed             # upserts 6 fixed slots (idempotent, safe to re-run)
# shortcut: npm run db:setup
```

Seeded slots (fixed UUIDs, UTC, `endsAt > startsAt`):

| id | startsAt (UTC) | endsAt (UTC) |
|----|----|----|
| `11111111-1111-4111-8111-111111111111` | 2030-01-15T09:00:00.000Z | 2030-01-15T09:30:00.000Z |
| `33333333-3333-4333-8333-333333333333` | 2030-01-15T09:30:00.000Z | 2030-01-15T10:00:00.000Z |
| `55555555-5555-4555-8555-555555555555` | 2030-01-15T10:00:00.000Z | 2030-01-15T10:30:00.000Z |
| `66666666-6666-4666-8666-666666666666` | 2030-01-15T10:30:00.000Z | 2030-01-15T11:00:00.000Z |
| `77777777-7777-4777-8777-777777777777` | 2030-01-15T11:00:00.000Z | 2030-01-15T11:30:00.000Z |
| `88888888-8888-4888-8888-888888888888` | 2030-01-15T11:30:00.000Z | 2030-01-15T12:00:00.000Z |

## 5. Run

```bash
npm run start:dev   # watch mode (dev)
npm run build && npm run start:prod   # production
```

- API base: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Health (extra, not in spec): `http://localhost:3000/health`

Quick manual check:

```bash
curl localhost:3000/slots
curl -X POST localhost:3000/bookings -H "Content-Type: application/json" \
  -d '{"slotId":"11111111-1111-4111-8111-111111111111","customerName":"Alex Morgan","customerEmail":"alex@example.com"}'
```

## 6. Test database setup + running tests

```bash
# 1) create a SEPARATE Neon DB/branch, e.g. neondb_test
# 2) point the shell at it and migrate it once:
export TEST_DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.neon.tech/neondb_test?sslmode=require"
npx prisma migrate deploy   # uses DATABASE_URL -> temporarily set DATABASE_URL to the test URL, or run migrate from dashboard SQL

# 3) run:
npm test        # unit tests (validation, error envelope, utils) — no DB needed
npm run test:e2e  # e2e against REAL Postgres (TEST_DATABASE_URL) — the 3 mandatory scenarios
```

The e2e suite (`test/bookings.e2e-spec.ts`) wipes `bookings` and reseeds 3 fixed slots
before each test, so runs are repeatable. It covers exactly the mandatory cases:

1. booking succeeds with `201` and the slot disappears from `GET /slots`;
2. **two overlapping** `POST /bookings` for the same slot (fired via one `Promise.all`,
   never sequentially) → one `201` + one `409 SLOT_UNAVAILABLE`, exactly one active row;
3. `DELETE` returns `200`, the slot is re-listed, a new booking succeeds, and a
   repeat-cancel of the old booking is a no-op `200` that leaves the new booking intact.

> Note: `prisma migrate deploy` reads `DATABASE_URL`, so to migrate the *test* DB, set
> `DATABASE_URL` to the test URL for that one command (or apply `prisma/migrations/0001_init/migration.sql`
> in the Neon SQL editor), then restore it.

## 7. Socket.IO realtime (no UI needed)

- Same server, default namespace `/`, path `/socket.io`. No auth, no rooms, client sends nothing.
- After a committed `201`: `slot.booked` → `{"slotId","bookingId","available":false}`
- After a real cancel: `slot.released` → `{"slotId","bookingId","available":true}`
- No events for rejections or repeat cancels; events never carry customer data.

Headless check (needs `socket.io-client`, already a dependency):

```bash
# terminal A
npm run start:dev
# terminal B
npm run socket:test        # or: SOCKET_URL=https://<your-app> node scripts/socket-test.mjs
# terminal C — create/cancel bookings and watch terminal B print the events
curl -X POST localhost:3000/bookings -H "Content-Type: application/json" \
  -d '{"slotId":"33333333-3333-4333-8333-333333333333","customerName":"Racer One","customerEmail":"one@example.com"}'
```

## 8. Deploy notes (Vercel + Neon)

- `vercel.json` rewrites everything to `api/index.ts`, which boots the same Nest app
  (`src/bootstrap.ts` is shared between `src/main.ts` and the serverless entry).
- Set `DATABASE_URL` in Vercel env vars; run `npx prisma migrate deploy && npm run db:seed`
  once against the Neon DB from your machine.
- Swagger UI works on Vercel (`/docs`, `/openapi.json`). Socket.IO emits there are
  best-effort — realtime needs a long-running host (local, VPS, Render…); see §10.

## 9. How double-booking is prevented (key decisions)

**Data design** (`prisma/schema.prisma` + `prisma/migrations/0001_init/migration.sql`):

- `Slot(id, startsAt, endsAt)` — no availability flag. *Available* is **derived**:
  a slot with zero `active` bookings. Nothing can desync.
- `Booking(id, slotId → Slot, customerName, customerEmail, status ∈ {active, cancelled})`.
  History is kept (cancelled rows stay), so rebooking works and old bookings stay addressable.
- `CHECK (ends_at > starts_at)` at the DB level.

**Concurrency — defence in depth (2 layers)**, implemented in
`src/bookings/bookings.service.ts`:

1. **Row lock (primary):** `create()` runs in a transaction that does
   `SELECT … FROM "slots" WHERE id = … FOR UPDATE` first. Concurrent bookers of the
   *same* slot serialise on that row: the loser waits, then sees the winner's committed
   active booking and gets `409`. Different slots never block each other.
2. **Partial unique index (safety net):**
   `CREATE UNIQUE INDEX … ON bookings(slot_id) WHERE status='active'` — Postgres itself
   rejects a second active booking; the `P2002` violation is mapped to `409 SLOT_UNAVAILABLE`
   (in the service and again in `GlobalExceptionFilter`), never `500`.

**Other decisions worth knowing for the interview:**

- `src/common/errors/` — one `DomainError` type + a global filter; every response
  (validation, bad JSON, bad UUID, unknown route, unexpected crash) has the spec's
  `{error:{code,message}}` shape, and `500`s never leak stacks or SQL.
- Trimming happens in the DTO (`@Transform`) **before** `class-validator` runs, so
  `"  Alex  "` validates and stores as `"Alex"`.
- Cancel is one atomic `updateMany({where:{id,status:'active'}})`: first call flips +
  emits `slot.released`; repeats (even concurrent ones) return the same `200` payload
  with no new event and can never touch a newer booking.
- Events fire **after** the DB commit, exactly once per state change.
- `POST`/`DELETE` use id UUIDs generated app-side (`crypto.randomUUID`); no DB extension needed.

## 10. Possible improvements (with more time)

- Rate-limit booking attempts per slot/IP (abuse protection).
- Cursor pagination on `GET /slots` once the catalogue grows.
- Outbox table + at-least-once relay if socket delivery guarantees ever become required
  (spec explicitly doesn't require them).
- Optimistic UI key (`Idempotency-Key` header) so client retries can't double-create
  across network failures (DB race itself is already safe).

## 11. Actual time & gaps

- **Actual build time:** ~3 hours in a single AI-assisted session (includes schema design,
  implementation, docs, tests, and verification below).
- **Verified here:** `tsc --noEmit` clean, `npm run build` clean, **9/9 unit tests pass**
  (`npm test`: DTO validation/trimming, error-envelope mapping incl. `P2002→409` and
  `500` sanitisation, utils).
- **Not executed in this sandbox:** `npm run test:e2e` needs a reachable PostgreSQL
  (Neon) — this environment has no PG credentials, and a scratch local cluster couldn't
  serve connections (Windows shared-memory `error 487`). The suite runs against **real**
  Postgres with genuinely overlapping requests (`Promise.all`, real transactions +
  row lock + partial index) — run it with `TEST_DATABASE_URL` set per §6 before the interview.
- **Socket.IO on Vercel** is best-effort (serverless); full realtime verified locally
  via `npm run socket:test`. Nothing else is missing: all 3 routes, error codes, OpenAPI
  endpoints, seed, migrations, and ZIP contents per spec are complete.

## 12. AI disclosure

Built with AI assistance (code generator + review loop). I then reviewed every file,
typechecked (`tsc --noEmit`), built (`npm run build`), and ran the unit suite
(`npm test` — 9/9 green). I understand the code and can explain or live-edit any part
(concurrency lock, filter mapping, DTO validation, gateway) in the interview.
No AI-generated secrets or credentials are included; `.env.example` holds placeholders only.
