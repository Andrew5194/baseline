import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and, gte, lt } from 'drizzle-orm';
import {
  focusHoursV1,
  cycleTimeDaysV1,
  throughputTasksV1,
  commitCountV1,
  activeDaysV1,
  streakDaysV1,
  consistencyScoreV1,
  deepWorkDaysV1,
  linesChangedV1,
  avgPrSizeV1,
  reviewCountV1,
  reviewRatioV1,
  dayOfWeekDistributionV1,
  peakDayV1,
  computeDelta,
} from '@baseline/metrics';
import { getCurrentUserId } from '../../../../lib/user';

const WINDOW_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const window = request.nextUrl.searchParams.get('window') || '30d';
  const days = WINDOW_DAYS[window];

  if (!days) {
    return NextResponse.json(
      { error: 'Invalid window. Use 7d, 30d, or 90d', code: 'INVALID_WINDOW' },
      { status: 400 },
    );
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStart = new Date(windowStart.getTime() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      eventType: events.eventType,
      occurredAt: events.occurredAt,
      payload: events.payload,
    })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.occurredAt, prevStart), lt(events.occurredAt, now)));

  const ei = rows.map((r) => ({
    eventType: r.eventType,
    occurredAt: r.occurredAt,
    payload: r.payload as Record<string, unknown> | null,
  }));

  const m = (fn: (e: typeof ei, s: Date, e2: Date) => number | null) => {
    const curr = fn(ei, windowStart, now);
    const prev = fn(ei, prevStart, windowStart);
    return { value: curr, delta: computeDelta(curr, prev) };
  };

  return NextResponse.json({
    window,
    metrics: {
      // Output
      focus_hours: { ...m(focusHoursV1), unit: 'hours' },
      commits: { ...m(commitCountV1), unit: 'commits' },
      throughput: { ...m(throughputTasksV1), unit: 'prs' },
      lines_changed: { ...m(linesChangedV1), unit: 'lines' },
      active_days: { ...m(activeDaysV1), unit: 'days' },
      deep_work_days: { ...m(deepWorkDaysV1), unit: 'days' },

      // Velocity
      cycle_time: { ...m(cycleTimeDaysV1), unit: 'days' },
      avg_pr_size: { ...m(avgPrSizeV1), unit: 'lines' },
      reviews: { ...m(reviewCountV1), unit: 'reviews' },
      review_ratio: { ...m(reviewRatioV1), unit: 'ratio' },

      // Calibration
      consistency: { ...m(consistencyScoreV1), unit: 'score' },
      streak: { ...m(streakDaysV1), unit: 'days' },
    },
    patterns: {
      day_of_week: dayOfWeekDistributionV1(ei, windowStart, now),
      peak_day: peakDayV1(ei, windowStart, now),
    },
  });
}
