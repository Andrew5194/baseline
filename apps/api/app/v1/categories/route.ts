import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  categories,
  categoryColors,
  goals,
  todos,
  recurringTodos,
  recurringAllocations,
  events,
  DEFAULT_CATEGORIES,
} from '@baseline/db';
import { eq, and, count, isNotNull, sql } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// GET /v1/categories — user's categories, each with its color (from category_colors,
// keyed by name) and a usage `count` of referencing goals/tasks/allocations/time-entries.
// `in_use` = count > 0. Time entries carry the category name in their event payload.
export async function GET() {
  const userId = await getCurrentUserId();

  const [cats, colorRows, gC, tC, rtC, raC, evC] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, position: categories.position })
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.position, categories.name),
    db
      .select({ category: categoryColors.category, color: categoryColors.color })
      .from(categoryColors)
      .where(eq(categoryColors.userId, userId)),
    db.select({ cid: goals.categoryId, n: count() }).from(goals).where(and(eq(goals.userId, userId), isNotNull(goals.categoryId))).groupBy(goals.categoryId),
    db.select({ cid: todos.categoryId, n: count() }).from(todos).where(and(eq(todos.userId, userId), isNotNull(todos.categoryId))).groupBy(todos.categoryId),
    db.select({ cid: recurringTodos.categoryId, n: count() }).from(recurringTodos).where(and(eq(recurringTodos.userId, userId), isNotNull(recurringTodos.categoryId))).groupBy(recurringTodos.categoryId),
    db.select({ cid: recurringAllocations.categoryId, n: count() }).from(recurringAllocations).where(and(eq(recurringAllocations.userId, userId), isNotNull(recurringAllocations.categoryId))).groupBy(recurringAllocations.categoryId),
    db
      .select({ name: sql<string>`trim(${events.payload}->>'category')`, n: count() })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.source, 'manual'), sql`${events.payload}->>'category' is not null and trim(${events.payload}->>'category') <> ''`))
      .groupBy(sql`trim(${events.payload}->>'category')`),
  ]);

  const colors: Record<string, string> = {};
  for (const r of colorRows) colors[r.category] = r.color;

  const byId = new Map<string, number>();
  for (const rows of [gC, tC, rtC, raC]) {
    for (const r of rows) if (r.cid) byId.set(r.cid, (byId.get(r.cid) ?? 0) + Number(r.n));
  }
  const byName = new Map<string, number>();
  for (const r of evC) if (r.name) byName.set(r.name, (byName.get(r.name) ?? 0) + Number(r.n));

  const defaultNames = new Set(DEFAULT_CATEGORIES.map((d) => d.name.toLowerCase()));
  const list = cats.map((c) => {
    const cnt = (byId.get(c.id) ?? 0) + (byName.get(c.name) ?? 0);
    return { id: c.id, name: c.name, color: colors[c.name] ?? null, count: cnt, in_use: cnt > 0, is_default: defaultNames.has(c.name.toLowerCase()) };
  });

  return NextResponse.json({ categories: list });
}

// POST /v1/categories — create a category. Body: { name, color? }.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { name?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }
  const color = typeof body.color === 'string' ? body.color.trim() : '';

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), sql`lower(${categories.name}) = lower(${name})`))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: 'That category already exists', code: 'DUPLICATE' }, { status: 409 });
  }

  const posRows = await db
    .select({ max: sql<number>`coalesce(max(${categories.position}), -1)` })
    .from(categories)
    .where(eq(categories.userId, userId));
  const position = Number(posRows[0]?.max ?? -1) + 1;

  const [row] = await db
    .insert(categories)
    .values({ userId, name, position })
    .returning({ id: categories.id, name: categories.name });

  const hasColor = HEX.test(color);
  if (hasColor) {
    await db
      .insert(categoryColors)
      .values({ userId, category: name, color })
      .onConflictDoUpdate({ target: [categoryColors.userId, categoryColors.category], set: { color } });
  }

  return NextResponse.json({ id: row.id, name: row.name, color: hasColor ? color : null, count: 0, in_use: false }, { status: 201 });
}

// DELETE /v1/categories?id=... — delete a category and uncategorize everything
// that referenced it. The FK (ON DELETE SET NULL) nulls goals/tasks/allocations;
// time entries (name in payload) and the color row are cleaned up explicitly.
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required', code: 'INVALID_ID' }, { status: 400 });
  }

  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .limit(1);
  if (!cat) {
    return NextResponse.json({ error: 'Category not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const payloadMatch = and(eq(events.userId, userId), eq(events.source, 'manual'), sql`trim(${events.payload}->>'category') = ${cat.name}`);

  const [g, t, rt, ra, ev] = await Promise.all([
    db.select({ n: count() }).from(goals).where(and(eq(goals.userId, userId), eq(goals.categoryId, id))),
    db.select({ n: count() }).from(todos).where(and(eq(todos.userId, userId), eq(todos.categoryId, id))),
    db.select({ n: count() }).from(recurringTodos).where(and(eq(recurringTodos.userId, userId), eq(recurringTodos.categoryId, id))),
    db.select({ n: count() }).from(recurringAllocations).where(and(eq(recurringAllocations.userId, userId), eq(recurringAllocations.categoryId, id))),
    db.select({ n: count() }).from(events).where(payloadMatch),
  ]);

  // Strip category from time-entry payloads, drop its color, then delete the row
  // (FK cascade sets null on goals/tasks/allocations).
  await db.update(events).set({ payload: sql`${events.payload} - 'category'` }).where(payloadMatch);
  await db.delete(categoryColors).where(and(eq(categoryColors.userId, userId), eq(categoryColors.category, cat.name)));
  await db.delete(categories).where(and(eq(categories.userId, userId), eq(categories.id, id)));

  return NextResponse.json({
    deleted: cat.name,
    uncategorized: {
      goals: Number(g[0].n),
      todos: Number(t[0].n),
      recurring_todos: Number(rt[0].n),
      recurring_allocations: Number(ra[0].n),
      time_entries: Number(ev[0].n),
    },
  });
}

// PATCH /v1/categories?id=... — rename a category. Body: { name }.
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();
  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required', code: 'INVALID_ID' }, { status: 400 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }

  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .limit(1);
  if (!cat) {
    return NextResponse.json({ error: 'Category not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Block collisions with a *different* category (case-insensitive); a pure
  // recasing of the same category is allowed through.
  if (name.toLowerCase() !== cat.name.toLowerCase()) {
    const dupe = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), sql`lower(${categories.name}) = lower(${name})`))
      .limit(1);
    if (dupe[0]) {
      return NextResponse.json({ error: 'That category already exists', code: 'DUPLICATE' }, { status: 409 });
    }
  }

  // Rename the row — goals/tasks/allocations follow via the FK. The name-keyed color
  // row and time-entry payloads are updated to match.
  await db.update(categories).set({ name }).where(and(eq(categories.userId, userId), eq(categories.id, id)));
  await db.update(categoryColors).set({ category: name }).where(and(eq(categoryColors.userId, userId), eq(categoryColors.category, cat.name)));
  await db
    .update(events)
    .set({ payload: sql`jsonb_set(${events.payload}, '{category}', to_jsonb(${name}::text))` })
    .where(and(eq(events.userId, userId), eq(events.source, 'manual'), sql`trim(${events.payload}->>'category') = ${cat.name}`));

  return NextResponse.json({ id: cat.id, name });
}
