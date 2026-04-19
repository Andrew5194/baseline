import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and, lt, gte, lte, desc } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const searchParams = request.nextUrl.searchParams;

  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor');
  const source = searchParams.get('source');
  const since = searchParams.get('since');
  const until = searchParams.get('until');

  const conditions = [eq(events.userId, userId)];

  if (source) {
    conditions.push(eq(events.source, source));
  }
  if (since) {
    const d = new Date(since);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid since date', code: 'INVALID_DATE' }, { status: 400 });
    }
    conditions.push(gte(events.occurredAt, d));
  }
  if (until) {
    const d = new Date(until);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid until date', code: 'INVALID_DATE' }, { status: 400 });
    }
    conditions.push(lte(events.occurredAt, d));
  }
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parts = decoded.split('|');
      if (parts.length !== 2) throw new Error('malformed cursor');
      const d = new Date(parts[0]);
      if (isNaN(d.getTime())) throw new Error('invalid cursor date');
      conditions.push(lt(events.occurredAt, d));
    } catch {
      return NextResponse.json({ error: 'Invalid cursor', code: 'INVALID_CURSOR' }, { status: 400 });
    }
  }

  const rows = await db
    .select({
      id: events.id,
      source: events.source,
      sourceId: events.sourceId,
      eventType: events.eventType,
      occurredAt: events.occurredAt,
      durationMs: events.durationMs,
      payload: events.payload,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.occurredAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const last = data[data.length - 1];
    nextCursor = Buffer.from(
      `${last.occurredAt.toISOString()}|${last.id}`,
    ).toString('base64');
  }

  return NextResponse.json({
    data: data.map((r) => ({
      id: r.id,
      source: r.source,
      source_id: r.sourceId,
      event_type: r.eventType,
      occurred_at: r.occurredAt,
      duration_ms: r.durationMs,
      payload: r.payload,
    })),
    next_cursor: nextCursor,
  });
}
