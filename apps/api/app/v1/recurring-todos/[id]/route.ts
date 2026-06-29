import { NextRequest, NextResponse } from 'next/server';
import { db, recurringTodos, goals } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

const ALL_DAYS = 127;

// PATCH /v1/recurring-todos/[id] — edit a recurring task (title, days, goal tag).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { title?: string; days_mask?: number; goal_id?: string | null; category?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const updates: { title?: string; daysMask?: number; goalId?: string | null; category?: string | null } = {};
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: 'title is required', code: 'INVALID_TITLE' }, { status: 400 });
    updates.title = t;
  }
  if (Number.isInteger(body.days_mask) && body.days_mask! > 0) updates.daysMask = body.days_mask! & ALL_DAYS;
  // Goal and direct category are mutually exclusive: tagging one clears the other.
  if ('goal_id' in body) {
    const gid = typeof body.goal_id === 'string' && body.goal_id ? body.goal_id : null;
    updates.goalId = gid;
    if (gid) updates.category = null;
  }
  if ('category' in body) {
    const c = typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 120) : null;
    updates.category = c;
    if (c) updates.goalId = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes', code: 'INVALID_BODY' }, { status: 400 });
  }

  const [row] = await db
    .update(recurringTodos)
    .set(updates)
    .where(and(eq(recurringTodos.id, id), eq(recurringTodos.userId, userId)))
    .returning({ id: recurringTodos.id, title: recurringTodos.title, daysMask: recurringTodos.daysMask, goalId: recurringTodos.goalId, category: recurringTodos.category });

  if (!row) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  let goalTitle: string | null = null;
  let goalColor: string | null = null;
  let goalCategory: string | null = null;
  if (row.goalId) {
    const [g] = await db.select({ title: goals.title, color: goals.color, category: goals.category }).from(goals).where(eq(goals.id, row.goalId)).limit(1);
    goalTitle = g?.title ?? null;
    goalColor = g?.color ?? null;
    goalCategory = g?.category ?? null;
  }
  return NextResponse.json({
    id: row.id,
    title: row.title,
    days_mask: row.daysMask,
    goal_id: row.goalId,
    goal_title: goalTitle,
    goal_color: goalColor,
    goal_category: goalCategory,
    category: row.category,
  });
}

// DELETE /v1/recurring-todos/[id] — remove a recurring task (and its completions).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .delete(recurringTodos)
    .where(and(eq(recurringTodos.id, id), eq(recurringTodos.userId, userId)))
    .returning({ id: recurringTodos.id });

  if (!row) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
