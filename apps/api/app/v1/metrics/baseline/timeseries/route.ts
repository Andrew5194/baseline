import { NextRequest, NextResponse } from 'next/server';
import { db, events, goals, todos } from '@baseline/db';
import { eq, and, gte, lt } from 'drizzle-orm';
import { dayKeyInTz } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, periodBuckets, isPeriod, offsetNow, parseOffset } from '../../../../../lib/period';

const HOUR_MS = 3_600_000;
const METRICS = ['goals_completed', 'tasks_completed', 'hours_tracked', 'tracked_days'];
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Stamp {
  at: Date;
  ms: number;
}

// GET /v1/metrics/baseline/timeseries?metric=&period= — the metric per natural bucket
// across the full period (7 days / ~30 days / 12 months), for the bar chart.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const params = request.nextUrl.searchParams;
  const metric = params.get('metric') || '';
  const periodParam = params.get('period') || 'week';

  if (!METRICS.includes(metric)) {
    return NextResponse.json({ error: 'Invalid metric', code: 'INVALID_METRIC' }, { status: 400 });
  }
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const offset = parseOffset(params.get('offset'));
  const b = periodBounds(periodParam, offsetNow(periodParam, now, tz, offset), tz);
  const buckets = periodBuckets(periodParam, b.start, b.end, tz);

  // Pull only the dataset the requested metric needs, over the whole period.
  let stamps: Stamp[] = [];
  if (metric === 'goals_completed') {
    const rows = await db
      .select({ completedAt: goals.completedAt })
      .from(goals)
      .where(and(eq(goals.userId, userId), gte(goals.completedAt, b.start), lt(goals.completedAt, b.end)));
    stamps = rows.filter((r) => r.completedAt).map((r) => ({ at: r.completedAt as Date, ms: 0 }));
  } else if (metric === 'tasks_completed') {
    const rows = await db
      .select({ completedAt: todos.completedAt })
      .from(todos)
      .where(and(eq(todos.userId, userId), gte(todos.completedAt, b.start), lt(todos.completedAt, b.end)));
    stamps = rows.filter((r) => r.completedAt).map((r) => ({ at: r.completedAt as Date, ms: 0 }));
  } else {
    const rows = await db
      .select({ occurredAt: events.occurredAt, durationMs: events.durationMs })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.source, 'manual'), gte(events.occurredAt, b.start), lt(events.occurredAt, b.end)));
    stamps = rows.map((r) => ({ at: r.occurredAt, ms: r.durationMs ?? 0 }));
  }

  const valueFor = (rows: Stamp[]): number => {
    switch (metric) {
      case 'goals_completed':
      case 'tasks_completed':
        return rows.length;
      case 'hours_tracked':
        return round1(rows.reduce((a, v) => a + v.ms, 0) / HOUR_MS);
      case 'tracked_days':
        return new Set(rows.map((v) => dayKeyInTz(v.at, tz))).size;
      default:
        return 0;
    }
  };

  const data = buckets.map((bk) => {
    const rows = stamps.filter((v) => v.at >= bk.start && v.at < bk.end);
    return { date: dayKeyInTz(bk.start, tz), value: valueFor(rows) };
  });

  return NextResponse.json({ metric, period: periodParam, data });
}
