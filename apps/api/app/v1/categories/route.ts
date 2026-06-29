import { NextResponse } from 'next/server';
import { db, events, recurringAllocations, goals, todos, recurringTodos, categoryColors } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

// GET /v1/categories — the canonical set of the user's categories, merged across
// manual time entries, recurring allocations, goals, and tasks, plus any registered
// via a color override (i.e. created in the manage-categories modal). `in_use` flags
// the ones actually referenced somewhere, so the UI can tell a removable, registry-
// only category from one that's earned by usage.
export async function GET() {
  const userId = await getCurrentUserId();

  const used = new Set<string>();
  const add = (c: string | null | undefined) => {
    if (typeof c === 'string' && c.trim()) used.add(c.trim());
  };

  // Manual time-entry categories live in the event payload.
  const evRows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.source, 'manual')));
  for (const r of evRows) add((r.payload as { category?: string } | null)?.category);

  const allocRows = await db.select({ category: recurringAllocations.category }).from(recurringAllocations).where(eq(recurringAllocations.userId, userId));
  for (const r of allocRows) add(r.category);

  const goalRows = await db.select({ category: goals.category }).from(goals).where(eq(goals.userId, userId));
  for (const r of goalRows) add(r.category);

  const todoRows = await db.select({ category: todos.category }).from(todos).where(eq(todos.userId, userId));
  for (const r of todoRows) add(r.category);

  const recTodoRows = await db.select({ category: recurringTodos.category }).from(recurringTodos).where(eq(recurringTodos.userId, userId));
  for (const r of recTodoRows) add(r.category);

  // Registered (created and/or recolored) categories — may not be used yet.
  const registry = new Set<string>();
  const colorRows = await db.select({ category: categoryColors.category }).from(categoryColors).where(eq(categoryColors.userId, userId));
  for (const r of colorRows) if (r.category.trim()) registry.add(r.category.trim());

  const names = [...new Set([...used, ...registry])].sort((a, b) => a.localeCompare(b));
  const categories = names.map((name) => ({ name, in_use: used.has(name) }));

  return NextResponse.json({ categories });
}
