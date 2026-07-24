import { NextRequest, NextResponse } from 'next/server';
import { db, categories, goals, todos, recurringTodos, recurringAllocations, events } from '@baseline/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Human label for a weekday bitmask (bit i = weekday i, 0=Sun … 6=Sat).
function daysLabel(mask: number): string {
  if (mask === 127) return 'Every day';
  if (mask === 62) return 'Weekdays'; // Mon–Fri
  if (mask === 65) return 'Weekends'; // Sun + Sat
  const out: string[] = [];
  for (let i = 0; i < 7; i++) if (mask & (1 << i)) out.push(DAY_ABBR[i]);
  return out.join(', ') || '—';
}
// Human-readable duration: seconds under a minute, minutes under an hour, else hours.
function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.round((ms / 3_600_000) * 10) / 10}h`;
}

// GET /v1/categories/[id]/items — items linked to a category, each with a `meta` line
// (dates, recurrence, hours) so a delete confirmation / inspector can show what's affected.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!cat) {
    return NextResponse.json({ error: 'Category not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const tz = await getUserTimezone(userId);
  const fmtDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d); // YYYY-MM-DD

  const [goalRows, todoRows, recTodoRows, allocRows, entryRows] = await Promise.all([
    db.select({ title: goals.title, dueAt: goals.dueAt, done: goals.done }).from(goals).where(and(eq(goals.userId, userId), eq(goals.categoryId, id))),
    db.select({ title: todos.title, date: todos.date, done: todos.done }).from(todos).where(and(eq(todos.userId, userId), eq(todos.categoryId, id))).orderBy(desc(todos.date)),
    db.select({ title: recurringTodos.title, daysMask: recurringTodos.daysMask }).from(recurringTodos).where(and(eq(recurringTodos.userId, userId), eq(recurringTodos.categoryId, id))),
    db.select({ note: recurringAllocations.note, durationMs: recurringAllocations.durationMs, daysMask: recurringAllocations.daysMask }).from(recurringAllocations).where(and(eq(recurringAllocations.userId, userId), eq(recurringAllocations.categoryId, id))),
    db
      .select({ note: sql<string | null>`${events.payload}->>'note'`, occurredAt: events.occurredAt, durationMs: events.durationMs })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.source, 'manual'), sql`trim(${events.payload}->>'category') = ${cat.name}`))
      .orderBy(desc(events.occurredAt)),
  ]);

  // Raw `durationMs` so the client can sort the Duration column numerically (the
  // `hours` string is display-only).
  const items = [
    ...goalRows.map((r) => ({ type: 'goal', label: r.title, date: r.dueAt ?? '', schedule: '', hours: '', status: r.done ? 'Done' : 'Open', durationMs: 0 })),
    ...todoRows.map((r) => ({ type: 'task', label: r.title, date: r.date ?? '', schedule: '', hours: '', status: r.done ? 'Done' : 'Open', durationMs: 0 })),
    ...recTodoRows.map((r) => ({ type: 'recurring', label: r.title, date: '', schedule: daysLabel(r.daysMask), hours: '', status: '', durationMs: 0 })),
    ...allocRows.map((r) => ({ type: 'allocation', label: r.note?.trim() || 'Recurring allocation', date: '', schedule: daysLabel(r.daysMask), hours: `${fmtDuration(r.durationMs)}/day`, status: '', durationMs: r.durationMs })),
    ...entryRows.map((r) => ({ type: 'time entry', label: r.note?.trim() || 'Time entry', date: fmtDay(r.occurredAt), schedule: '', hours: fmtDuration(r.durationMs ?? 0), status: '', durationMs: r.durationMs ?? 0 })),
  ];

  return NextResponse.json({ category: cat.name, count: items.length, items });
}
