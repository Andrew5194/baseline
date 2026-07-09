import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
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
  // IANA timezone (e.g. 'America/New_York') used to bucket the user's activity
  // into local calendar days/weeks/months on the dashboard.
  timezone: text('timezone').notNull().default('UTC'),
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

// ── Goals ────────────────────────────────────────────────────────────────────
// A finite thing the user wants to accomplish, in their own words (e.g. "Ship the
// billing page", "Read Designing Data-Intensive Applications"). Checked off when
// done; `completedAt` powers the monthly completion heatmap.

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    // The time-allocation category this goal rolls up into, so tracked time on a
    // goal's tasks aggregates from goals → categories. Null = uncategorized.
    category: text('category'),
    // User-chosen color (hex). Null falls back to a deterministic palette color.
    color: text('color'),
    // Free-text notes about the goal.
    notes: text('notes'),
    // Optional target/expiration date (local day key, YYYY-MM-DD) — when the goal
    // should be accomplished by. Past + not done reads as overdue. Null = open-ended.
    dueAt: text('due_at'),
    // Manual sort order (drag-and-drop); lower sorts first.
    position: integer('position').notNull().default(0),
    done: boolean('done').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('goals_user_idx').on(table.userId)],
);

// ── Todos ────────────────────────────────────────────────────────────────────
// One-off tasks the user wants to get done — a simple checklist alongside the
// recurring goals.

export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    // The local day the task is scheduled for (YYYY-MM-DD). Defaults to the day it
    // was created, but can be a future date.
    date: text('date'),
    // The goal this task advances (tag). Null when untagged.
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    // A category tagged directly on the task (when not tagged to a goal). The task's
    // effective category is its goal's category if tagged, else this.
    category: text('category'),
    done: boolean('done').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('todos_user_idx').on(table.userId)],
);

// A standing task that recurs on the given weekdays (daysMask bit i = weekday i,
// 0=Sun … 6=Sat; 127 = every day). Shown in the list on matching days and checked
// off per day via recurringTodoCompletions.
export const recurringTodos = pgTable(
  'recurring_todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    daysMask: integer('days_mask').notNull().default(127),
    // The goal this recurring task advances (tag). Null when untagged.
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    // A category tagged directly on the task (when not tagged to a goal).
    category: text('category'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('recurring_todos_user_idx').on(table.userId)],
);

// One row per day a recurring todo was checked off. `date` is the local day key.
export const recurringTodoCompletions = pgTable(
  'recurring_todo_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    recurringTodoId: uuid('recurring_todo_id')
      .references(() => recurringTodos.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('recurring_todo_completions_idx').on(table.recurringTodoId, table.date),
    index('recurring_todo_completions_user_idx').on(table.userId),
  ],
);

// A free-text daily journal — one entry per local day, where the user records
// their thoughts and feelings for that day.
export const dayNotes = pgTable(
  'day_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(), // the local day key (YYYY-MM-DD)
    content: text('content').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('day_notes_user_date_idx').on(table.userId, table.date)],
);

// ── Rate limits ──────────────────────────────────────────────────────────────
// Fixed-window counters for auth-abuse control. One row per (action, IP, time
// bucket); the count is bumped atomically per request and expired rows are swept
// by the rate_limit_cleanup cron. Not tied to a user.
export const rateLimits = pgTable(
  'rate_limits',
  {
    // "<action>:<ip>:<windowBucket>" — same bucket → same row within the window.
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limits_expires_idx').on(table.expiresAt)],
);
