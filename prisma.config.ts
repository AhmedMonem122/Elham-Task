import { defineConfig } from 'prisma/config';

// NOTE: `prisma generate` doesn't need a live DB, but Prisma 7 resolves the
// datasource URL while loading this file. The dummy fallback lets `generate`
// run with no .env present; every command that touches the DB (migrate, seed,
// app, tests) still requires the real DATABASE_URL / TEST_DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/db';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
