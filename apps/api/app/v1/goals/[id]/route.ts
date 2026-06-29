import { NextRequest, NextResponse } from 'next/server';
import { db, goals, todos, recurringTodos } from '@baseline/db';
import { eq, and, asc, desc } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

// GET /v1/goals/[id] — goal detail (incl. notes) plus the tasks tagged to it: the
// one-off todos and recurring tasks in this goal's category.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [goal] = await db
    .select({
      id: goals.id,
      title: goals.title,
      category: goals.category,
      color: goals.color,
      notes: goals.notes,
      done: goals.done,
      completedAt: goals.completedAt,
    })
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);

  if (!goal) {
    return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const taggedTodos = await db
    .select({ id: todos.id, title: todos.title, done: todos.done, date: todos.date })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.goalId, id)))
    .orderBy(asc(todos.done), desc(todos.createdAt));

  const taggedRecurring = await db
    .select({ id: recurringTodos.id, title: recurringTodos.title, daysMask: recurringTodos.daysMask })
    .from(recurringTodos)
    .where(and(eq(recurringTodos.userId, userId), eq(recurringTodos.goalId, id)))
    .orderBy(asc(recurringTodos.createdAt));

  return NextResponse.json({
    goal: {
      id: goal.id,
      title: goal.title,
      category: goal.category,
      color: goal.color,
      notes: goal.notes,
      done: goal.done,
      completed_at: goal.completedAt,
    },
    todos: taggedTodos,
    recurring: taggedRecurring.map((r) => ({ id: r.id, title: r.title, days_mask: r.daysMask })),
  });
}

// PATCH /v1/goals/[id] — mark done/undone, rename, recolor, and/or edit notes.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { done?: boolean; title?: string; category?: string | null; color?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const updates: { done?: boolean; completedAt?: Date | null; title?: string; category?: string | null; color?: string; notes?: string } = {};
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
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) {
    updates.color = body.color;
  }
  if (body.category === null) {
    updates.category = null;
  } else if (typeof body.category === 'string') {
    const c = body.category.trim();
    updates.category = c ? c.slice(0, 120) : null;
  }
  if (typeof body.notes === 'string') {
    updates.notes = body.notes.slice(0, 5000);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update', code: 'INVALID_BODY' }, { status: 400 });
  }

  const [row] = await db
    .update(goals)
    .set(updates)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning({ id: goals.id });

  if (!row) {
    return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /v1/goals/[id] — remove a goal.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning({ id: goals.id });

  if (!row) {
    return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
