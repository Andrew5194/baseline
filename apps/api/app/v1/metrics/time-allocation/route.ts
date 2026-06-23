import { NextRequest, NextResponse } from 'next/server';
import { db, events, recurringAllocations } from '@baseline/db';
import { eq, and, gte, lt, gt } from 'drizzle-orm';
import { hoursByCategoryV1, computeDelta, recurringToEvents } from '@baseline/metrics';
import type { EventInput } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../lib/user';
import { periodBounds, isPeriod } from '../../../../lib/period';

const round1 = (n: number) => Math.round(n * 10) / 10;

// GET /v1/metrics/time-allocation?period=week|month|year — budget out of the period's
// allocatable hours (24 × days), with per-category hours, share of budget, and delta
// vs the previous period. Recurring routines are counted only up to today, so the
// donut fills as the period progresses.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const tz = await getUserTimezone(userId);
  const { start, end, prevStart, budgetHours } = periodBounds(periodParam, now, tz);

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
        gte(events.occurredAt, prevStart),
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

  // Fold in standing recurring allocations (sleep, meals, …) across the whole
  // period, including future days, since they're a planned routine.
  const recurring = await db
    .select({
      category: recurringAllocations.category,
      durationMs: recurringAllocations.durationMs,
      daysMask: recurringAllocations.daysMask,
    })
    .from(recurringAllocations)
    .where(eq(recurringAllocations.userId, userId));
  ei.push(...recurringToEvents(recurring, prevStart, end, tz));

  const curr = hoursByCategoryV1(ei, start, end);
  const prev = hoursByCategoryV1(ei, prevStart, start);

  const categories = Object.entries(curr)
    .map(([category, hours]) => ({
      category,
      hours,
      pct: round1((hours / budgetHours) * 100),
      delta: computeDelta(hours, prev[category] ?? null),
    }))
    .sort((a, b) => b.hours - a.hours);

  const tracked = round1(categories.reduce((s, c) => s + c.hours, 0));
  const free = round1(Math.max(budgetHours - tracked, 0));

  return NextResponse.json({
    period: periodParam,
    budget: budgetHours,
    tracked_hours: tracked,
    free_hours: free,
    categories,
  });
}
