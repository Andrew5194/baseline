import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { manualTimeEntryPayload } from '@baseline/events';
import { getCurrentUserId, getUserTimezone } from '../../../../lib/user';
import { resolveEntryTiming } from '../../../../lib/time-entry';

const HOUR_MS = 60 * 60 * 1000;
const MAX_HOURS = 24 * 7;

const entryFromRow = (r: { id: string; occurredAt: Date; durationMs: number | null; payload: unknown }) => {
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

// PUT /v1/time-entries/{id} — update a manual entry the user owns.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { from?: string; to?: string; occurred_at?: string; date?: string; hours?: number; category?: string; note?: string };
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

  // Preserve the task link (the edit form doesn't manage it).
  const [existing] = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId), eq(events.source, 'manual')))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  const prev = (existing.payload ?? {}) as { task_id?: string };

  const parsed = manualTimeEntryPayload.safeParse({ category: body.category, note: body.note, timed: timing.timed, task_id: prev.task_id });
  if (!parsed.success) {
    return NextResponse.json({ error: 'category is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }

  const [row] = await db
    .update(events)
    .set({
      occurredAt: timing.occurredAt,
      durationMs: timing.durationMs,
      payload: parsed.data,
    })
    .where(and(eq(events.id, id), eq(events.userId, userId), eq(events.source, 'manual')))
    .returning({
      id: events.id,
      occurredAt: events.occurredAt,
      durationMs: events.durationMs,
      payload: events.payload,
    });

  if (!row) {
    return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(entryFromRow(row));
}

// DELETE /v1/time-entries/{id} — remove a manual entry the user owns.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.userId, userId), eq(events.source, 'manual')))
    .returning({ id: events.id });

  if (!row) {
    return NextResponse.json({ error: 'Entry not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ id: row.id, deleted: true });
}
