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
} from '@baseline/metrics';
import { dayKeyInTz, addLocalDays } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../lib/user';
import { periodBounds, periodBuckets, endOfToday, isPeriod, offsetNow, parseOffset } from '../../../../lib/period';

const WINDOW_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

type MetricFn = (events: Array<{ eventType: string; occurredAt: Date; payload: Record<string, unknown> | null }>, start: Date, end: Date, tz: string) => number | null;

const METRIC_FNS: Record<string, MetricFn> = {
  focus_hours: focusHoursV1,
  cycle_time: cycleTimeDaysV1,
  throughput: throughputTasksV1,
  commits: commitCountV1,
  active_days: activeDaysV1,
  streak: streakDaysV1,
  consistency: consistencyScoreV1,
  deep_work_days: deepWorkDaysV1,
  lines_changed: linesChangedV1,
  avg_pr_size: avgPrSizeV1,
  reviews: reviewCountV1,
  review_ratio: reviewRatioV1,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const params = request.nextUrl.searchParams;
  const metric = params.get('metric');
  const periodParam = params.get('period');
  // bucket=day → daily (heatmap); absent → the period's natural buckets (bar chart).
  const bucket = params.get('bucket');

  if (!metric || !METRIC_FNS[metric]) {
    return NextResponse.json({ error: 'Invalid metric', code: 'INVALID_METRIC' }, { status: 400 });
  }

  const now = new Date();
  const todayEnd = endOfToday(now, tz);
  // Local-day buckets (each one local calendar day as a UTC-instant range).
  const dailyBuckets = (start: Date, end: Date) => {
    const out: Array<{ start: Date; end: Date }> = [];
    let c = start;
    while (c.getTime() < end.getTime()) {
      const e = addLocalDays(c, 1, tz);
      out.push({ start: c, end: e });
      c = e;
    }
    return out;
  };

  // Two bucketing modes:
  //   bucket=day → daily, capped at today (the heatmap needs daily cells)
  //   default    → the period's natural buckets across the FULL period, matching the
  //                Overview chart: 7 days (week), ~30 days (month), 12 months (year)
  let fetchStart: Date;
  let fetchEnd: Date;
  let buckets: Array<{ start: Date; end: Date }>;
  let granularity: 'day' | 'month' = 'day';
  let label: string;

  if (periodParam) {
    if (!isPeriod(periodParam)) {
      return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
    }
    const offset = parseOffset(params.get('offset'));
    const b = periodBounds(periodParam, offsetNow(periodParam, now, tz, offset), tz);
    label = periodParam;
    if (bucket === 'day') {
      fetchStart = b.start;
      fetchEnd = b.end < todayEnd ? b.end : todayEnd;
      buckets = dailyBuckets(fetchStart, fetchEnd);
    } else {
      fetchStart = b.start;
      fetchEnd = b.end;
      buckets = periodBuckets(periodParam, b.start, b.end, tz);
      granularity = b.granularity;
    }
  } else {
    const window = params.get('window') || '30d';
    const days = WINDOW_DAYS[window];
    if (!days) {
      return NextResponse.json({ error: 'Invalid window', code: 'INVALID_WINDOW' }, { status: 400 });
    }
    fetchStart = new Date(now.getTime() - days * DAY_MS);
    fetchEnd = now;
    buckets = dailyBuckets(fetchStart, fetchEnd);
    label = window;
  }

  const rows = await db
    .select({
      eventType: events.eventType,
      occurredAt: events.occurredAt,
      payload: events.payload,
    })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.occurredAt, fetchStart), lt(events.occurredAt, fetchEnd)));

  const eventInputs = rows.map((r) => ({
    eventType: r.eventType,
    occurredAt: r.occurredAt,
    payload: r.payload as Record<string, unknown> | null,
  }));

  const metricFn = METRIC_FNS[metric];
  const data = buckets.map((bk) => ({
    date: dayKeyInTz(bk.start, tz),
    value: metricFn(eventInputs, bk.start, bk.end, tz) ?? 0,
  }));

  return NextResponse.json({ metric, period: label, window: label, granularity, data });
}
