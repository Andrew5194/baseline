import { NextRequest, NextResponse } from 'next/server';
import { db, todos, recurringTodos, recurringTodoCompletions } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { dayKeyInTz } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';

// POST /v1/tasks/[id]/complete — mark a task complete regardless of its type. A one-off
// todo is set done; a recurring task is checked off for today. Powers the "mark
// complete" action on the post-timer confirmation toast.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [todo] = await db
    .select({ id: todos.id })
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .limit(1);
  if (todo) {
    await db
      .update(todos)
      .set({ done: true, completedAt: new Date() })
      .where(and(eq(todos.id, id), eq(todos.userId, userId)));
    return NextResponse.json({ ok: true, kind: 'todo' });
  }

  const [rt] = await db
    .select({ id: recurringTodos.id })
    .from(recurringTodos)
    .where(and(eq(recurringTodos.id, id), eq(recurringTodos.userId, userId)))
    .limit(1);
  if (rt) {
    const tz = await getUserTimezone(userId);
    const date = dayKeyInTz(new Date(), tz);
    await db
      .insert(recurringTodoCompletions)
      .values({ userId, recurringTodoId: id, date })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true, kind: 'recurring' });
  }

  return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
}
