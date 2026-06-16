import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { manualTimeEntryPayload } from '@baseline/events';
import { getCurrentUserId } from '../../../../lib/user';

const HOUR_MS = 60 * 60 * 1000;
const MAX_HOURS = 24 * 7;

const entryFromRow = (r: { id: string; occurredAt: Date; durationMs: number | null; payload: unknown }) => {
  const p = (r.payload ?? {}) as { category?: string; note?: string };
  return {
    id: r.id,
    occurred_at: r.occurredAt,
    hours: Math.round(((r.durationMs ?? 0) / HOUR_MS) * 100) / 100,
    category: p.category ?? 'Other',
    note: p.note ?? null,
  };
};

// PUT /v1/time-entries/{id} — update a manual entry the user owns.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { occurred_at?: string; hours?: number; category?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : null;
  if (!occurredAt || isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Valid occurred_at is required', code: 'INVALID_DATE' }, { status: 400 });
  }
  if (typeof body.hours !== 'number' || !(body.hours > 0) || body.hours > MAX_HOURS) {
    return NextResponse.json({ error: `hours must be between 0 and ${MAX_HOURS}`, code: 'INVALID_HOURS' }, { status: 400 });
  }
  const parsed = manualTimeEntryPayload.safeParse({ category: body.category, note: body.note });
  if (!parsed.success) {
    return NextResponse.json({ error: 'category is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }

  const [row] = await db
    .update(events)
    .set({
      occurredAt,
      durationMs: Math.round(body.hours * HOUR_MS),
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
