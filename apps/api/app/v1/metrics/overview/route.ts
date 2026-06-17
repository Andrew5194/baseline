import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and, gte, lt } from 'drizzle-orm';
import {
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
import { periodBounds, isPeriod } from '../../../../lib/period';

const WINDOW_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const params = request.nextUrl.searchParams;
  const periodParam = params.get('period');
  const now = new Date();

  // Calendar period (week/month/year) — matches the Overview — or the legacy
  // trailing window (7d/30d/90d) when no period is given.
  let windowStart: Date;
  let windowEnd: Date;
  let prevStart: Date;
  let label: string;
  if (periodParam) {
    if (!isPeriod(periodParam)) {
      return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
    }
    const b = periodBounds(periodParam, now);
    windowStart = b.start;
    windowEnd = b.end;
    prevStart = b.prevStart;
    label = periodParam;
  } else {
    const window = params.get('window') || '30d';
    const days = WINDOW_DAYS[window];
    if (!days) {
      return NextResponse.json({ error: 'Invalid window. Use 7d, 30d, or 90d', code: 'INVALID_WINDOW' }, { status: 400 });
    }
    windowEnd = now;
    windowStart = new Date(now.getTime() - days * DAY_MS);
    prevStart = new Date(windowStart.getTime() - days * DAY_MS);
    label = window;
  }
  const now2 = windowEnd; // end of the current window

  const rows = await db
    .select({
      eventType: events.eventType,
      occurredAt: events.occurredAt,
      payload: events.payload,
    })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.occurredAt, prevStart), lt(events.occurredAt, now2)));

  const ei = rows.map((r) => ({
    eventType: r.eventType,
    occurredAt: r.occurredAt,
    payload: r.payload as Record<string, unknown> | null,
  }));

  const m = (fn: (e: typeof ei, s: Date, e2: Date) => number | null) => {
    const curr = fn(ei, windowStart, now2);
    const prev = fn(ei, prevStart, windowStart);
    return { value: curr, delta: computeDelta(curr, prev) };
  };

  return NextResponse.json({
    period: label,
    window: label,
    metrics: {
      // Output
      commits: { ...m(commitCountV1), unit: 'commits' },
      throughput: { ...m(throughputTasksV1), unit: 'prs' },
      lines_changed: { ...m(linesChangedV1), unit: 'lines' },
      active_days: { ...m(activeDaysV1), unit: 'days' },
      deep_work_days: { ...m(deepWorkDaysV1), unit: 'days' },

      // Velocity
      avg_pr_size: { ...m(avgPrSizeV1), unit: 'lines' },
      reviews: { ...m(reviewCountV1), unit: 'reviews' },
      review_ratio: { ...m(reviewRatioV1), unit: 'ratio' },

      // Calibration
      consistency: { ...m(consistencyScoreV1), unit: 'score' },
      streak: { ...m(streakDaysV1), unit: 'days' },
    },
    patterns: {
      day_of_week: dayOfWeekDistributionV1(ei, windowStart, now2),
      peak_day: peakDayV1(ei, windowStart, now2),
    },
  });
}
