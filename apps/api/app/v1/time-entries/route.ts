import { NextRequest, NextResponse } from 'next/server';
import { db, events, resolveCategoryId } from '@baseline/db';
import { eq, and, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { EVENT_TYPES, manualTimeEntryPayload } from '@baseline/events';
import { getCurrentUserId, getUserTimezone } from '../../../lib/user';
import { periodBounds, isPeriod, offsetNow, parseOffset } from '../../../lib/period';
import { resolveEntryTiming } from '../../../lib/time-entry';

const HOUR_MS = 60 * 60 * 1000;
const MAX_HOURS = 24 * 7; // one week

const entryFromRow = (r: {
  id: string;
  occurredAt: Date;
  durationMs: number | null;
  payload: unknown;
}) => {
  const p = (r.payload ?? {}) as { category?: string; note?: string; timed?: boolean; task_id?: string };
  return {
    id: r.id,
    occurred_at: r.occurredAt,
    hours: Math.round(((r.durationMs ?? 0) / HOUR_MS) * 100) / 100,
    category: p.category ?? 'Other',
    note: p.note ?? null,
    timed: p.timed === true,
    task_id: p.task_id ?? null,
  };
};

// GET /v1/time-entries?period=week|month|year — manual entries in the calendar
// period + distinct categories.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();

  // Entries attributed to one task (all time, oldest first) — powers the list of
  // logged sessions shown when a task's timer drop-down is open.
  const taskId = request.nextUrl.searchParams.get('task_id');
  if (taskId) {
    const taskRows = await db
      .select({ id: events.id, occurredAt: events.occurredAt, durationMs: events.durationMs, payload: events.payload })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.source, 'manual'), sql`${events.payload} ->> 'task_id' = ${taskId}`))
      .orderBy(asc(events.occurredAt));
    return NextResponse.json({ data: taskRows.map(entryFromRow), categories: [] });
  }

  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const tz = await getUserTimezone(userId);
  const offset = parseOffset(request.nextUrl.searchParams.get('offset'));
  const { start, end } = periodBounds(periodParam, offsetNow(periodParam, new Date(), tz, offset), tz);

  const manual = and(eq(events.userId, userId), eq(events.source, 'manual'));

  const rows = await db
    .select({
      id: events.id,
      occurredAt: events.occurredAt,
      durationMs: events.durationMs,
      payload: events.payload,
    })
    .from(events)
    .where(and(manual, gte(events.occurredAt, start), lt(events.occurredAt, end)))
    .orderBy(desc(events.occurredAt));

  // Distinct categories across all of the user's manual entries (for the form).
  const all = await db
    .select({ payload: events.payload })
    .from(events)
    .where(manual);
  const categories = [
    ...new Set(
      all
        .map((r) => (r.payload as { category?: string } | null)?.category)
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0),
    ),
  ].sort();

  return NextResponse.json({ data: rows.map(entryFromRow), categories });
}

// POST /v1/time-entries — create a manual time entry.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { from?: string; to?: string; occurred_at?: string; date?: string; hours?: number; category?: string; note?: string; timed?: boolean; task_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const tz = await getUserTimezone(userId);
  const timing = resolveEntryTiming(body, tz);
  if ('error' in timing) {
    const msg =
      timing.error === 'INVALID_RANGE'
        ? 'End time must be after start time'
        : timing.error === 'INVALID_HOURS'
          ? `hours must be between 0 and ${MAX_HOURS}`
          : 'Valid date is required';
    return NextResponse.json({ error: msg, code: timing.error }, { status: 400 });
  }
  if (timing.durationMs > MAX_HOURS * HOUR_MS) {
    return NextResponse.json({ error: `duration must be under ${MAX_HOURS} hours`, code: 'INVALID_HOURS' }, { status: 400 });
  }

  const parsed = manualTimeEntryPayload.safeParse({ category: body.category, note: body.note, timed: timing.timed, task_id: body.task_id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'category is required', code: 'INVALID_CATEGORY' },
      { status: 400 },
    );
  }

  // Category name lives in the payload, but still register it in the categories table
  // so it appears in the category list (which reads from there).
  if (typeof body.category === 'string' && body.category.trim()) {
    await resolveCategoryId(userId, body.category);
  }

  const [row] = await db
    .insert(events)
    .values({
      userId,
      source: 'manual',
      sourceId: crypto.randomUUID(),
      eventType: EVENT_TYPES.MANUAL_TIME_ENTRY_CREATED,
      occurredAt: timing.occurredAt,
      durationMs: timing.durationMs,
      payload: parsed.data,
    })
    .returning({
      id: events.id,
      occurredAt: events.occurredAt,
      durationMs: events.durationMs,
      payload: events.payload,
    });

  return NextResponse.json(entryFromRow(row), { status: 201 });
}
