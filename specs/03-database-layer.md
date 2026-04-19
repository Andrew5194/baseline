# Spec 03: Database layer

## Context

The monorepo restructure (spec 02) created `packages/db` as an empty scaffold. Before any feature work can happen — auth, integrations, metrics — we need the database schema, migrations, and a typed client that other packages and apps can import. The three core tables (`users`, `integrations`, `events`) were designed in spec 01 and are implemented here.

## Goal

Stand up Drizzle ORM in `packages/db` with the v1 schema, working migrations, and a reusable typed client that connects to the PostgreSQL instance from `docker-compose.yml`.

## Prerequisites

- Spec 02 is complete (monorepo structure exists)
- PostgreSQL 16 is running via `docker compose up` or locally
- `pnpm` is available at the repo root

## In scope

- Drizzle ORM setup in `packages/db`
- Schema definition for `users`, `integrations`, `events` tables per spec 01
- Migration generation and application
- Typed database client exported from `packages/db`
- Seed script for local development (one test user)
- Connection configuration via `DATABASE_URL` environment variable

## Out of scope

- Row-level security (phase 2)
- KMS encryption for tokens (phase 2)
- TimescaleDB hypertables (phase 2)
- Any API endpoints (spec 04)
- Auth session tables (spec 05 — Auth.js manages its own tables)

## Requirements

1. `packages/db/src/schema.ts` defines three tables using Drizzle's `pgTable`:

   **`users`**
   - `id` — uuid, primary key, default `gen_random_uuid()`
   - `email` — text, unique, not null
   - `name` — text, nullable
   - `created_at` — timestamptz, default `now()`

   **`integrations`**
   - `id` — uuid, primary key, default `gen_random_uuid()`
   - `user_id` — uuid, foreign key → `users.id`, not null
   - `provider` — text, not null (e.g. `github`, `gcal`)
   - `status` — text, not null, default `connected`
   - `access_token` — text, nullable
   - `refresh_token` — text, nullable
   - `token_expires_at` — timestamptz, nullable
   - `external_account_id` — text, nullable
   - `connected_at` — timestamptz, default `now()`
   - `last_synced_at` — timestamptz, nullable
   - Unique constraint on `(user_id, provider)`

   **`events`**
   - `id` — uuid, primary key, default `gen_random_uuid()`
   - `user_id` — uuid, foreign key → `users.id`, not null
   - `source` — text, not null
   - `source_id` — text, not null
   - `event_type` — text, not null
   - `occurred_at` — timestamptz, not null
   - `ingested_at` — timestamptz, default `now()`
   - `duration_ms` — bigint, nullable
   - `payload` — jsonb, nullable
   - `schema_version` — integer, default `1`
   - Unique constraint on `(source, source_id, event_type)`
   - Indexes: `(user_id, occurred_at desc)`, `(user_id, source, occurred_at desc)`

2. `packages/db/src/client.ts` exports a `db` instance created from `drizzle(pool)` using `DATABASE_URL`.

3. `packages/db/src/index.ts` re-exports the schema, client, and Drizzle types.

4. `packages/db/drizzle.config.ts` configures Drizzle Kit for migration generation.

5. Running `pnpm --filter @baseline/db generate` produces a migration in `packages/db/drizzle/`.

6. Running `pnpm --filter @baseline/db migrate` applies the migration to the database.

7. Running `pnpm --filter @baseline/db seed` inserts a test user (`dev@baseline.local`).

8. All three tables can be queried from a consuming app via `import { db, users } from '@baseline/db'`.

## File changes

### Created
- `packages/db/src/schema.ts` — table definitions
- `packages/db/src/client.ts` — database connection and Drizzle instance
- `packages/db/src/index.ts` — re-exports
- `packages/db/drizzle.config.ts` — Drizzle Kit configuration
- `packages/db/src/seed.ts` — development seed script
- `packages/db/drizzle/` — generated migration files (after running generate)

### Modified
- `packages/db/package.json` — add `drizzle-orm`, `postgres`, `drizzle-kit` dependencies and scripts

### Deleted
- `packages/db/src/index.ts` — replace placeholder export with real re-exports

## Acceptance criteria

- `pnpm --filter @baseline/db generate` produces a migration file without errors
- `pnpm --filter @baseline/db migrate` applies the migration to a running PostgreSQL instance
- `pnpm --filter @baseline/db seed` creates a user row visible via `psql`
- `pnpm build` exits zero across the entire repo
- `pnpm type-check` exits zero — the schema types are valid
- Importing `{ db, users, integrations, events }` from `@baseline/db` in `apps/api` compiles

## Notes for Claude Code

- Use `postgres` (postgres.js) as the driver, not `pg`. Drizzle works best with postgres.js.
- Use `drizzle-orm/postgres-js` for the Drizzle adapter.
- `DATABASE_URL` comes from the environment. For local dev it's `postgresql://aml:changeme@localhost:5432/aml` (matching docker-compose defaults).
- Do not create Auth.js session/account tables here. Auth.js will manage its own schema in spec 05.
- Keep the schema file flat — all three tables in one file for now. Split when it gets unwieldy.
- The `payload` column is `jsonb` typed loosely for now. Zod validation of payload shapes happens in `packages/events` (spec not yet written).
