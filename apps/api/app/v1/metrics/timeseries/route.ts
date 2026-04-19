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
import { getCurrentUserId } from '../../../../lib/user';

const WINDOW_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

type MetricFn = (events: Array<{ eventType: string; occurredAt: Date; payload: Record<string, unknown> | null }>, start: Date, end: Date) => number | null;

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

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const searchParams = request.nextUrl.searchParams;
  const metric = searchParams.get('metric');
  const window = searchParams.get('window') || '30d';
  const bucket = searchParams.get('bucket') || 'day';

  if (!metric || !METRIC_FNS[metric]) {
    return NextResponse.json({ error: 'Invalid metric', code: 'INVALID_METRIC' }, { status: 400 });
  }

  const days = WINDOW_DAYS[window];
  if (!days) {
    return NextResponse.json({ error: 'Invalid window', code: 'INVALID_WINDOW' }, { status: 400 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      eventType: events.eventType,
      occurredAt: events.occurredAt,
      payload: events.payload,
    })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.occurredAt, windowStart), lt(events.occurredAt, now)));

  const eventInputs = rows.map((r) => ({
    eventType: r.eventType,
    occurredAt: r.occurredAt,
    payload: r.payload as Record<string, unknown> | null,
  }));

  const bucketDays = bucket === 'week' ? 7 : 1;
  const metricFn = METRIC_FNS[metric];
  const data: Array<{ date: string; value: number }> = [];

  const cursor = new Date(windowStart);
  while (cursor < now) {
    const bucketEnd = new Date(cursor.getTime() + bucketDays * 24 * 60 * 60 * 1000);
    const val = metricFn(eventInputs, cursor, bucketEnd > now ? now : bucketEnd);
    data.push({
      date: cursor.toISOString().split('T')[0],
      value: val ?? 0,
    });
    cursor.setTime(bucketEnd.getTime());
  }

  return NextResponse.json({ metric, window, bucket, data });
}
