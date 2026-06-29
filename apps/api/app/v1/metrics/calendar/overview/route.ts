import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@baseline/db';
import { eq, and, gte, lt } from 'drizzle-orm';
import { dayKeyInTz, computeDelta } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, isPeriod } from '../../../../../lib/period';

const SOURCE = 'google_calendar';
const HOUR_MS = 3_600_000;

interface Ev {
  occurredAt: Date;
  durationMs: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const within = (evs: Ev[], s: Date, e: Date) => evs.filter((v) => v.occurredAt >= s && v.occurredAt < e);
const totalHours = (evs: Ev[]) => evs.reduce((a, v) => a + v.durationMs, 0) / HOUR_MS;
const busyDays = (evs: Ev[], tz: string) => new Set(evs.map((v) => dayKeyInTz(v.occurredAt, tz))).size;
const avgMinutes = (evs: Ev[]) => (evs.length ? (totalHours(evs) * 60) / evs.length : 0);

// GET /v1/metrics/calendar/overview?period=week|month|year — period-to-date
// calendar metrics (meeting hours, events, avg length, busy days) with a delta vs
// the same elapsed slice of the prior period.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const b = periodBounds(periodParam, now, tz);
  const currEnd = now < b.end ? now : b.end;
  const elapsedMs = currEnd.getTime() - b.start.getTime();
  const prevEnd = new Date(b.prevStart.getTime() + elapsedMs);

  const rows = await db
    .select({ occurredAt: events.occurredAt, durationMs: events.durationMs })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.source, SOURCE),
        gte(events.occurredAt, b.prevStart),
        lt(events.occurredAt, currEnd),
      ),
    );
  const all: Ev[] = rows.map((r) => ({ occurredAt: r.occurredAt, durationMs: r.durationMs ?? 0 }));

  const curr = within(all, b.start, currEnd);
  const prev = within(all, b.prevStart, prevEnd);
  const mk = (cv: number, pv: number, unit: string) => ({ value: cv, delta: computeDelta(cv, pv), unit });

  return NextResponse.json({
    period: periodParam,
    metrics: {
      meeting_hours: mk(round1(totalHours(curr)), round1(totalHours(prev)), 'hrs'),
      events: mk(curr.length, prev.length, 'events'),
      avg_length: mk(Math.round(avgMinutes(curr)), Math.round(avgMinutes(prev)), 'min'),
      busy_days: mk(busyDays(curr, tz), busyDays(prev, tz), 'days'),
    },
  });
}
