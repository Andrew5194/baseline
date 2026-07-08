import { NextRequest, NextResponse } from 'next/server';
import { db, todos, goals, recurringTodos, recurringTodoCompletions } from '@baseline/db';
import { eq, asc, desc } from 'drizzle-orm';
import { dayKeyInTz } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../lib/user';
import { monthDayKeys } from '../../../lib/month-heatmap';

const weekdayOf = (dayKey: string): number => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const toDto = (r: {
  id: string;
  title: string;
  done: boolean;
  date: string | null;
  createdAt: Date;
  completedAt: Date | null;
  goalId: string | null;
  goalTitle: string | null;
  goalColor: string | null;
  goalCategory: string | null;
  category: string | null;
}) => ({
  id: r.id,
  title: r.title,
  done: r.done,
  date: r.date ?? dayKeyInTz(r.createdAt, 'UTC'),
  completed_at: r.completedAt,
  goal_id: r.goalId,
  goal_title: r.goalTitle,
  goal_color: r.goalColor,
  goal_category: r.goalCategory,
  category: r.category,
  recurring: false,
});

// GET /v1/todos — one-off tasks (with their scheduled day), the user's recurring
// tasks + completions, and a monthly heatmap of completed/total tasks per day.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const now = new Date();
  // Which month the heatmap covers — 0 = current, 1 = last month, … (clamped).
  const monthOffset = Math.min(600, Math.max(0, parseInt(request.nextUrl.searchParams.get('month_offset') || '0', 10) || 0));

  const rows = await db
    .select({
      id: todos.id,
      title: todos.title,
      done: todos.done,
      date: todos.date,
      createdAt: todos.createdAt,
      completedAt: todos.completedAt,
      goalId: todos.goalId,
      goalTitle: goals.title,
      goalColor: goals.color,
      goalCategory: goals.category,
      category: todos.category,
    })
    .from(todos)
    .leftJoin(goals, eq(todos.goalId, goals.id))
    .where(eq(todos.userId, userId))
    .orderBy(asc(todos.done), desc(todos.createdAt));

  const recurringRows = await db
    .select({
      id: recurringTodos.id,
      title: recurringTodos.title,
      daysMask: recurringTodos.daysMask,
      createdAt: recurringTodos.createdAt,
      goalId: recurringTodos.goalId,
      goalTitle: goals.title,
      goalColor: goals.color,
      goalCategory: goals.category,
      category: recurringTodos.category,
    })
    .from(recurringTodos)
    .leftJoin(goals, eq(recurringTodos.goalId, goals.id))
    .where(eq(recurringTodos.userId, userId))
    .orderBy(asc(recurringTodos.createdAt));
  const recurring = recurringRows.map((r) => ({
    id: r.id,
    title: r.title,
    daysMask: r.daysMask,
    since: dayKeyInTz(r.createdAt, tz), // doesn't apply before this day
    goalId: r.goalId,
    goalTitle: r.goalTitle,
    goalColor: r.goalColor,
    goalCategory: r.goalCategory,
    category: r.category,
  }));

  const completions = await db
    .select({
      recurringTodoId: recurringTodoCompletions.recurringTodoId,
      date: recurringTodoCompletions.date,
      createdAt: recurringTodoCompletions.createdAt,
    })
    .from(recurringTodoCompletions)
    .where(eq(recurringTodoCompletions.userId, userId));

  const data = rows.map(toDto);

  // Per-day heatmap: a day's total = one-off tasks scheduled that day + recurring
  // tasks scheduled that day; completed = the done ones.
  const regByDay = new Map<string, { total: number; done: number }>();
  for (const t of data) {
    const e = regByDay.get(t.date) ?? { total: 0, done: 0 };
    e.total += 1;
    if (t.done) e.done += 1;
    regByDay.set(t.date, e);
  }
  const recDoneByDay = new Map<string, number>();
  for (const c of completions) recDoneByDay.set(c.date, (recDoneByDay.get(c.date) ?? 0) + 1);

  const heatmap = monthDayKeys(now, tz, monthOffset).map((date) => {
    const wd = weekdayOf(date);
    const recScheduled = recurring.filter((r) => (r.daysMask & (1 << wd)) !== 0 && r.since <= date).length;
    const reg = regByDay.get(date) ?? { total: 0, done: 0 };
    return { date, completed: reg.done + (recDoneByDay.get(date) ?? 0), total: reg.total + recScheduled };
  });

  return NextResponse.json({
    data,
    heatmap,
    recurring: recurring.map((r) => ({
      id: r.id,
      title: r.title,
      days_mask: r.daysMask,
      since: r.since,
      goal_id: r.goalId,
      goal_title: r.goalTitle,
      goal_color: r.goalColor,
      goal_category: r.goalCategory,
      category: r.category,
    })),
    completions: completions.map((c) => ({ recurring_todo_id: c.recurringTodoId, date: c.date, completed_at: c.createdAt })),
  });
}

// POST /v1/todos — add a one-off task, optionally scheduled for a given day.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);

  let body: { title?: string; date?: string; goal_id?: string; category?: string | null };
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
  const date =
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : dayKeyInTz(new Date(), tz);
  const goalId = typeof body.goal_id === 'string' && body.goal_id ? body.goal_id : null;
  // A direct category only applies when the task isn't tagged to a goal.
  const category = !goalId && typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 120) : null;

  const [row] = await db
    .insert(todos)
    .values({ userId, title, date, goalId, category })
    .returning({ id: todos.id, title: todos.title, done: todos.done, date: todos.date, createdAt: todos.createdAt, completedAt: todos.completedAt, goalId: todos.goalId, category: todos.category });

  // Resolve the goal title/color/category for the response.
  let goalTitle: string | null = null;
  let goalColor: string | null = null;
  let goalCategory: string | null = null;
  if (row.goalId) {
    const [g] = await db.select({ title: goals.title, color: goals.color, category: goals.category }).from(goals).where(eq(goals.id, row.goalId)).limit(1);
    goalTitle = g?.title ?? null;
    goalColor = g?.color ?? null;
    goalCategory = g?.category ?? null;
  }
  return NextResponse.json(toDto({ ...row, goalTitle, goalColor, goalCategory }), { status: 201 });
}
