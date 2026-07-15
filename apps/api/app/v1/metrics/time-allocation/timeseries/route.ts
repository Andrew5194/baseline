import { NextRequest, NextResponse } from 'next/server';
import { db, events, recurringAllocations, categories } from '@baseline/db';
import { eq, and, gte, lt, gt } from 'drizzle-orm';
import { hoursByCategoryV1, recurringToEvents, dayKeyInTz } from '@baseline/metrics';
import type { EventInput } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, periodBuckets, isPeriod, offsetNow, parseOffset } from '../../../../../lib/period';

// GET /v1/metrics/time-allocation/timeseries?period=week|month|year
// Buckets spanning the whole period: daily for week/month (each ~24h), monthly
// totals for year. Recurring routines are projected across the full period, so
// future days/months show the standing routine; one-off work only appears up to
// today.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const offset = parseOffset(request.nextUrl.searchParams.get('offset'));
  const tz = await getUserTimezone(userId);
  const { start, end, granularity } = periodBounds(periodParam, offsetNow(periodParam, now, tz, offset), tz);

  const rows = await db
    .select({
      occurredAt: events.occurredAt,
      durationMs: events.durationMs,
      source: events.source,
      payload: events.payload,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        gt(events.durationMs, 0),
        gte(events.occurredAt, start),
        lt(events.occurredAt, end),
      ),
    );

  const ei: EventInput[] = rows.map((r) => ({
    eventType: '',
    occurredAt: r.occurredAt,
    payload: r.payload as Record<string, unknown> | null,
    durationMs: r.durationMs,
    source: r.source,
  }));

  // Skip standing routines when the caller asks to focus on free time.
  if (request.nextUrl.searchParams.get('recurring') !== 'exclude') {
    const recurringRows = await db
      .select({
        category: categories.name,
        durationMs: recurringAllocations.durationMs,
        daysMask: recurringAllocations.daysMask,
      })
      .from(recurringAllocations)
      .leftJoin(categories, eq(recurringAllocations.categoryId, categories.id))
      .where(eq(recurringAllocations.userId, userId));
    // Uncategorized allocations trim to the "Other" bucket (via categoryOf).
    const recurring = recurringRows.map((r) => ({ ...r, category: r.category ?? '' }));
    ei.push(...recurringToEvents(recurring, start, end, tz));
  }

  const seen = new Set<string>();
  // Daily buckets sum to a day's hours; monthly (year) buckets sum to the month's
  // total hours by category.
  const data = periodBuckets(periodParam, start, end, tz).map((b) => {
    const byCategory = hoursByCategoryV1(ei, b.start, b.end);
    Object.keys(byCategory).forEach((c) => seen.add(c));
    return { date: dayKeyInTz(b.start, tz), by_category: byCategory };
  });

  return NextResponse.json({
    period: periodParam,
    granularity,
    categories: [...seen].sort(),
    data,
  });
}
