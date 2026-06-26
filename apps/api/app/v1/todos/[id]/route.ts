import { NextRequest, NextResponse } from 'next/server';
import { db, todos } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

// PATCH /v1/todos/[id] — toggle done and/or rename.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { done?: boolean; title?: string; goal_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const updates: { done?: boolean; completedAt?: Date | null; title?: string; goalId?: string | null } = {};
  if (typeof body.done === 'boolean') {
    updates.done = body.done;
    updates.completedAt = body.done ? new Date() : null;
  }
  if (typeof body.title === 'string') {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: 'title cannot be empty', code: 'INVALID_TITLE' }, { status: 400 });
    }
    updates.title = title;
  }
  // goal_id present (string → tag, null → untag).
  if ('goal_id' in body) {
    updates.goalId = typeof body.goal_id === 'string' && body.goal_id ? body.goal_id : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update', code: 'INVALID_BODY' }, { status: 400 });
  }

  const [row] = await db
    .update(todos)
    .set(updates)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning({ id: todos.id });

  if (!row) {
    return NextResponse.json({ error: 'Todo not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /v1/todos/[id] — remove a to-do.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning({ id: todos.id });

  if (!row) {
    return NextResponse.json({ error: 'Todo not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
