import { NextRequest, NextResponse } from 'next/server';
import { db, recurringTodos, goals } from '@baseline/db';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

const ALL_DAYS = 127;

const toDto = (r: {
  id: string;
  title: string;
  daysMask: number;
  goalId: string | null;
  goalTitle: string | null;
  goalColor: string | null;
  goalCategory: string | null;
  category: string | null;
}) => ({
  id: r.id,
  title: r.title,
  days_mask: r.daysMask,
  goal_id: r.goalId,
  goal_title: r.goalTitle,
  goal_color: r.goalColor,
  goal_category: r.goalCategory,
  category: r.category,
});

// GET /v1/recurring-todos — the user's recurring tasks (with their goal tag).
export async function GET() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select({
      id: recurringTodos.id,
      title: recurringTodos.title,
      daysMask: recurringTodos.daysMask,
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

  return NextResponse.json({ data: rows.map(toDto) });
}

// POST /v1/recurring-todos — add a recurring task, optionally tagged to a goal.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { title?: string; days_mask?: number; goal_id?: string; category?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required', code: 'INVALID_TITLE' }, { status: 400 });
  }
  const daysMask =
    Number.isInteger(body.days_mask) && body.days_mask! > 0 ? body.days_mask! & ALL_DAYS : ALL_DAYS;
  const goalId = typeof body.goal_id === 'string' && body.goal_id ? body.goal_id : null;
  const category = !goalId && typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 120) : null;

  const [row] = await db
    .insert(recurringTodos)
    .values({ userId, title, daysMask, goalId, category })
    .returning({ id: recurringTodos.id, title: recurringTodos.title, daysMask: recurringTodos.daysMask, goalId: recurringTodos.goalId, category: recurringTodos.category });

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
