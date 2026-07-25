import { NextResponse } from 'next/server';
import {
  db,
  users,
  goals,
  todos,
  recurringTodos,
  recurringTodoCompletions,
  categories,
  categoryColors,
  recurringAllocations,
  events,
  integrations,
  dayNotes,
} from '@baseline/db';
import { eq } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';
import { allow } from '../../../../lib/rate-limit';

// GET /v1/me/export — the current user's full data as one JSON document. Read-only and
// streamed in the response (nothing is stored server-side, so no storage cost). Excludes
// secrets (password hash, OAuth tokens) and auth internals (accounts/sessions).
export async function GET() {
  const userId = await getCurrentUserId();

  // Export reads the user's whole dataset; cap it so it can't be hammered.
  if (!(await allow('export', userId))) {
    return NextResponse.json(
      { error: 'Too many exports. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  const [profile] = await db
    .select({
      email: users.email,
      name: users.name,
      timezone: users.timezone,
      preferences: users.preferences,
      created_at: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const [cats, colors, goalRows, todoRows, recurring, completions, allocations, eventRows, integ, notes] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(categoryColors).where(eq(categoryColors.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(todos).where(eq(todos.userId, userId)),
    db.select().from(recurringTodos).where(eq(recurringTodos.userId, userId)),
    db.select().from(recurringTodoCompletions).where(eq(recurringTodoCompletions.userId, userId)),
    db.select().from(recurringAllocations).where(eq(recurringAllocations.userId, userId)),
    db.select().from(events).where(eq(events.userId, userId)),
    // Integrations without the OAuth tokens.
    db
      .select({
        provider: integrations.provider,
        status: integrations.status,
        external_account_id: integrations.externalAccountId,
        connected_at: integrations.connectedAt,
        last_synced_at: integrations.lastSyncedAt,
      })
      .from(integrations)
      .where(eq(integrations.userId, userId)),
    db.select().from(dayNotes).where(eq(dayNotes.userId, userId)),
  ]);

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    user: profile,
    categories: cats,
    category_colors: colors,
    goals: goalRows,
    todos: todoRows,
    recurring_todos: recurring,
    recurring_todo_completions: completions,
    recurring_allocations: allocations,
    events: eventRows,
    day_notes: notes,
    integrations: integ,
  });
}
