import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import { EVENT_TYPES, manualTimeEntryPayload } from '@baseline/events';
import { getCurrentUserId, getUserTimezone } from '../../../lib/user';
import { periodBounds, isPeriod } from '../../../lib/period';
import { resolveOccurredAt } from '../../../lib/time-entry';

const HOUR_MS = 60 * 60 * 1000;
const MAX_HOURS = 24 * 7; // one week

const entryFromRow = (r: {
  id: string;
  occurredAt: Date;
  durationMs: number | null;
  payload: unknown;
}) => {
  const p = (r.payload ?? {}) as { category?: string; note?: string; timed?: boolean };
  return {
    id: r.id,
    occurred_at: r.occurredAt,
    hours: Math.round(((r.durationMs ?? 0) / HOUR_MS) * 100) / 100,
    category: p.category ?? 'Other',
    note: p.note ?? null,
    timed: p.timed === true,
  };
};

// GET /v1/time-entries?period=week|month|year — manual entries in the calendar
// period + distinct categories.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const tz = await getUserTimezone(userId);
  const { start, end } = periodBounds(periodParam, new Date(), tz);

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

  let body: { occurred_at?: string; date?: string; hours?: number; category?: string; note?: string; timed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const tz = await getUserTimezone(userId);
  const occurredAt = resolveOccurredAt(body, tz);
  if (!occurredAt || isNaN(occurredAt.getTime())) {
    return NextResponse.json(
      { error: 'Valid date is required', code: 'INVALID_DATE' },
      { status: 400 },
    );
  }
  if (typeof body.hours !== 'number' || !(body.hours > 0) || body.hours > MAX_HOURS) {
    return NextResponse.json(
      { error: `hours must be between 0 and ${MAX_HOURS}`, code: 'INVALID_HOURS' },
      { status: 400 },
    );
  }

  const parsed = manualTimeEntryPayload.safeParse({ category: body.category, note: body.note, timed: body.timed });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'category is required', code: 'INVALID_CATEGORY' },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(events)
    .values({
      userId,
      source: 'manual',
      sourceId: crypto.randomUUID(),
      eventType: EVENT_TYPES.MANUAL_TIME_ENTRY_CREATED,
      occurredAt,
      durationMs: Math.round(body.hours * HOUR_MS),
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
