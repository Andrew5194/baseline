import { NextRequest, NextResponse } from 'next/server';
import { db, goals, todos, categories, resolveCategoryId } from '@baseline/db';
import { eq, asc, desc, and, inArray, count } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

// Columns selected for a goal row (shared by the active + completed queries).
const goalCols = {
  id: goals.id,
  title: goals.title,
  category: categories.name,
  color: goals.color,
  dueAt: goals.dueAt,
  done: goals.done,
  completedAt: goals.completedAt,
  createdAt: goals.createdAt,
};

// Tally tagged tasks (total + done) for a set of goal ids. Only queries the todos
// tied to the goals actually being returned, so a page of completed goals doesn't
// scan the user's whole todo table.
async function taskCounts(userId: string, ids: string[]): Promise<Map<string, { total: number; done: number }>> {
  const counts = new Map<string, { total: number; done: number }>();
  if (ids.length === 0) return counts;
  const tagged = await db
    .select({ goalId: todos.goalId, done: todos.done })
    .from(todos)
    .where(and(eq(todos.userId, userId), inArray(todos.goalId, ids)));
  for (const t of tagged) {
    if (!t.goalId) continue;
    const e = counts.get(t.goalId) ?? { total: 0, done: 0 };
    e.total += 1;
    if (t.done) e.done += 1;
    counts.set(t.goalId, e);
  }
  return counts;
}

// GET /v1/goals
//   (default)                        → active (open) goals in manual order + { completed_count }
//   ?status=completed&limit=&offset= → a page of completed goals, newest completion
//                                      first, + { has_more }
// Completed goals are paginated and lazy-loaded (the client fetches them only when
// the "Completed" section is expanded), so the Goals page stays fast no matter how
// many goals have been finished.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const { searchParams } = new URL(request.url);

  if (searchParams.get('status') === 'completed') {
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);
    const rows = await db
      .select(goalCols)
      .from(goals)
      .leftJoin(categories, eq(goals.categoryId, categories.id))
      .where(and(eq(goals.userId, userId), eq(goals.done, true)))
      .orderBy(desc(goals.completedAt), desc(goals.createdAt))
      .limit(limit + 1) // one extra row tells us whether another page exists
      .offset(offset);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const counts = await taskCounts(userId, page.map((r) => r.id));
    const data = page.map((r) => {
      const c = counts.get(r.id) ?? { total: 0, done: 0 };
      return { id: r.id, title: r.title, category: r.category, color: r.color, due_at: r.dueAt, done: r.done, completed_at: r.completedAt, task_total: c.total, task_done: c.done };
    });
    return NextResponse.json({ data, has_more: hasMore });
  }

  // Default: active goals only, in manual order, plus a count of completed ones so
  // the "Completed (N)" label is accurate without loading the whole list.
  const rows = await db
    .select(goalCols)
    .from(goals)
    .leftJoin(categories, eq(goals.categoryId, categories.id))
    .where(and(eq(goals.userId, userId), eq(goals.done, false)))
    .orderBy(asc(goals.position), desc(goals.createdAt));
  const counts = await taskCounts(userId, rows.map((r) => r.id));
  const data = rows.map((r) => {
    const c = counts.get(r.id) ?? { total: 0, done: 0 };
    return { id: r.id, title: r.title, category: r.category, color: r.color, due_at: r.dueAt, done: r.done, completed_at: r.completedAt, task_total: c.total, task_done: c.done };
  });

  const [completedRow] = await db
    .select({ value: count() })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.done, true)));

  return NextResponse.json({ data, completed_count: Number(completedRow?.value ?? 0) });
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
