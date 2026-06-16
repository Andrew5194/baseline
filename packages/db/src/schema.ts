import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  passwordHash: text('password_hash'),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Auth.js tables ─────────────────────────────────────────────────────────

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ],
);

// ── Integrations ───────────────────────────────────────────────────────────

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    provider: text('provider').notNull(),
    status: text('status').notNull().default('connected'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    externalAccountId: text('external_account_id'),
    connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('integrations_user_provider_idx').on(table.userId, table.provider),
  ],
);

// ── Events ─────────────────────────────────────────────────────────────────

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
    durationMs: bigint('duration_ms', { mode: 'number' }),
    payload: jsonb('payload'),
    schemaVersion: integer('schema_version').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('events_source_dedup_idx').on(table.userId, table.source, table.sourceId, table.eventType),
    index('events_user_occurred_idx').on(table.userId, table.occurredAt),
    index('events_user_source_occurred_idx').on(table.userId, table.source, table.occurredAt),
  ],
);

// ── Recurring allocations ────────────────────────────────────────────────────
// A standing daily routine (sleep, meals, etc.). Not stored as events — these are
// templates expanded across the displayed window when computing time allocation.

export const recurringAllocations = pgTable(
  'recurring_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    category: text('category').notNull(),
    durationMs: bigint('duration_ms', { mode: 'number' }).notNull(),
    // Bitmask of weekdays the allocation applies to: bit i (0=Sun … 6=Sat).
    // 127 = every day.
    daysMask: integer('days_mask').notNull().default(127),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('recurring_allocations_user_idx').on(table.userId)],
);

// ── Category colors ──────────────────────────────────────────────────────────
// Per-user color override for a category. Falls back to a deterministic default
// when absent, so users only persist the ones they deliberately changed.

export const categoryColors = pgTable(
  'category_colors',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    category: text('category').notNull(),
    color: text('color').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.category] })],
);
