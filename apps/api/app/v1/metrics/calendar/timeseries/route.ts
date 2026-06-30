import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and, gte, lt } from 'drizzle-orm';
import { dayKeyInTz } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, periodBuckets, isPeriod, offsetNow, parseOffset } from '../../../../../lib/period';

const SOURCE = 'google_calendar';
const HOUR_MS = 3_600_000;
const METRICS = ['meeting_hours', 'events', 'avg_length', 'busy_days'];

interface Ev {
  occurredAt: Date;
  durationMs: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// GET /v1/metrics/calendar/timeseries?metric=&period= — the metric per natural
// bucket across the full period (7 days / ~30 days / 12 months), for the bar chart.
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

  const rows = await db
    .select({ occurredAt: events.occurredAt, durationMs: events.durationMs })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.source, SOURCE),
        gte(events.occurredAt, b.start),
        lt(events.occurredAt, b.end),
      ),
    );
  const all: Ev[] = rows.map((r) => ({ occurredAt: r.occurredAt, durationMs: r.durationMs ?? 0 }));

  const valueFor = (evs: Ev[]): number => {
    switch (metric) {
      case 'meeting_hours':
        return round1(evs.reduce((a, v) => a + v.durationMs, 0) / HOUR_MS);
      case 'events':
        return evs.length;
      case 'avg_length':
        return evs.length ? Math.round(((evs.reduce((a, v) => a + v.durationMs, 0) / HOUR_MS) * 60) / evs.length) : 0;
      case 'busy_days':
        return new Set(evs.map((v) => dayKeyInTz(v.occurredAt, tz))).size;
      default:
        return 0;
    }
  };

  const data = buckets.map((bk) => {
    const evs = all.filter((v) => v.occurredAt >= bk.start && v.occurredAt < bk.end);
    return { date: dayKeyInTz(bk.start, tz), value: valueFor(evs) };
  });

  return NextResponse.json({ metric, period: periodParam, data });
}
