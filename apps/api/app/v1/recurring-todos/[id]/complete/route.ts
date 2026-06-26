import { NextRequest, NextResponse } from 'next/server';
import { db, recurringTodos, recurringTodoCompletions } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { dayKeyInTz } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';

// POST /v1/recurring-todos/[id]/complete — check/uncheck a recurring task for today.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { done?: boolean; date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const [rt] = await db
    .select({ id: recurringTodos.id })
    .from(recurringTodos)
    .where(and(eq(recurringTodos.id, id), eq(recurringTodos.userId, userId)))
    .limit(1);
  if (!rt) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const tz = await getUserTimezone(userId);
  const date =
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : dayKeyInTz(new Date(), tz);

  if (body.done) {
    await db
      .insert(recurringTodoCompletions)
      .values({ userId, recurringTodoId: id, date })
      .onConflictDoNothing();
  } else {
    await db
      .delete(recurringTodoCompletions)
      .where(and(eq(recurringTodoCompletions.recurringTodoId, id), eq(recurringTodoCompletions.date, date)));
  }

  return NextResponse.json({ ok: true });
}
