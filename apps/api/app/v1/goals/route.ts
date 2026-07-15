import { NextRequest, NextResponse } from 'next/server';
import { db, goals, todos, categories, resolveCategoryId } from '@baseline/db';
import { eq, asc, desc, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

// GET /v1/goals — the user's goals (overarching outcomes), open first, each with a
// count of the tasks tagged to it (how many of its steps are done).
export async function GET() {
  const userId = await getCurrentUserId();

  const rows = await db
    .select({ id: goals.id, title: goals.title, category: categories.name, color: goals.color, dueAt: goals.dueAt, done: goals.done, completedAt: goals.completedAt, createdAt: goals.createdAt })
    .from(goals)
    .leftJoin(categories, eq(goals.categoryId, categories.id))
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.done), asc(goals.position), desc(goals.createdAt));

  // Tally tagged tasks per goal.
  const taggedTasks = await db
    .select({ goalId: todos.goalId, done: todos.done })
    .from(todos)
    .where(and(eq(todos.userId, userId)));
  const counts = new Map<string, { total: number; done: number }>();
  for (const t of taggedTasks) {
    if (!t.goalId) continue;
    const e = counts.get(t.goalId) ?? { total: 0, done: 0 };
    e.total += 1;
    if (t.done) e.done += 1;
    counts.set(t.goalId, e);
  }

  const data = rows.map((r) => {
    const c = counts.get(r.id) ?? { total: 0, done: 0 };
    return { id: r.id, title: r.title, category: r.category, color: r.color, due_at: r.dueAt, done: r.done, completed_at: r.completedAt, task_total: c.total, task_done: c.done };
  });

  return NextResponse.json({ data });
}

// POST /v1/goals — add a goal.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { title?: string; category?: string; color?: string; due_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required', code: 'INVALID_TITLE' }, { status: 400 });
  }
  if (title.length > 280) {
    return NextResponse.json({ error: 'title is too long', code: 'INVALID_TITLE' }, { status: 400 });
  }

  const color = typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : null;
  const categoryName = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null;
  const categoryId = await resolveCategoryId(userId, body.category);
  const dueAt = typeof body.due_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_at) ? body.due_at : null;

  const [row] = await db
    .insert(goals)
    .values({ userId, title, categoryId, color, dueAt })
    .returning({ id: goals.id, title: goals.title, color: goals.color, dueAt: goals.dueAt, done: goals.done, completedAt: goals.completedAt });

  return NextResponse.json(
    { id: row.id, title: row.title, category: categoryName, color: row.color, due_at: row.dueAt, done: row.done, completed_at: row.completedAt, task_total: 0, task_done: 0 },
    { status: 201 },
  );
}
