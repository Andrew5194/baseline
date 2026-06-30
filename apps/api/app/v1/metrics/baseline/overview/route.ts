import { NextRequest, NextResponse } from 'next/server';
import { db, events, goals, todos, users } from '@baseline/db';
import { eq, and, gte, lt, isNotNull } from 'drizzle-orm';
import { dayKeyInTz, computeDelta } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, isPeriod, offsetNow, parseOffset } from '../../../../../lib/period';

const HOUR_MS = 3_600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Stamp {
  at: Date;
  ms: number;
}

const hours = (rows: Stamp[]) => rows.reduce((a, v) => a + v.ms, 0) / HOUR_MS;
const distinctDays = (rows: Stamp[], tz: string) => new Set(rows.map((v) => dayKeyInTz(v.at, tz))).size;
const within = (rows: Stamp[], s: Date, e: Date) => rows.filter((v) => v.at >= s && v.at < e);

// GET /v1/metrics/baseline/overview?period=week|month|year — period-to-date Baseline
// activity (goals & tasks completed, hours tracked, days tracked) with a delta vs the
// same elapsed slice of the prior period.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const offset = parseOffset(request.nextUrl.searchParams.get('offset'));
  const b = periodBounds(periodParam, offsetNow(periodParam, now, tz, offset), tz);
  const currEnd = now < b.end ? now : b.end;
  const elapsedMs = currEnd.getTime() - b.start.getTime();
  const prevEnd = new Date(b.prevStart.getTime() + elapsedMs);

  const [goalRows, taskRows, entryRows] = await Promise.all([
    db
      .select({ completedAt: goals.completedAt })
      .from(goals)
      .where(and(eq(goals.userId, userId), gte(goals.completedAt, b.prevStart), lt(goals.completedAt, currEnd))),
    db
      .select({ completedAt: todos.completedAt })
      .from(todos)
      .where(and(eq(todos.userId, userId), gte(todos.completedAt, b.prevStart), lt(todos.completedAt, currEnd))),
    db
      .select({ occurredAt: events.occurredAt, durationMs: events.durationMs })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.source, 'manual'), gte(events.occurredAt, b.prevStart), lt(events.occurredAt, currEnd))),
  ]);

  const goalsDone: Stamp[] = goalRows.filter((r) => r.completedAt).map((r) => ({ at: r.completedAt as Date, ms: 0 }));
  const tasksDone: Stamp[] = taskRows.filter((r) => r.completedAt).map((r) => ({ at: r.completedAt as Date, ms: 0 }));
  const entries: Stamp[] = entryRows.map((r) => ({ at: r.occurredAt, ms: r.durationMs ?? 0 }));

  const gCurr = within(goalsDone, b.start, currEnd);
  const gPrev = within(goalsDone, b.prevStart, prevEnd);
  const tCurr = within(tasksDone, b.start, currEnd);
  const tPrev = within(tasksDone, b.prevStart, prevEnd);
  const eCurr = within(entries, b.start, currEnd);
  const ePrev = within(entries, b.prevStart, prevEnd);

  // All-time "expected" baseline: the average per bucket (a day for the week/month
  // views, a month for the year view) over the user's whole history — plus the raw
  // total ÷ buckets behind it, so the chart can show how the number was derived.
  const granularity: 'day' | 'month' = periodParam === 'year' ? 'month' : 'day';
  const todayKey = dayKeyInTz(now, tz);

  const [userRow, allGoals, allTasks, allEntries] = await Promise.all([
    db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ completedAt: goals.completedAt }).from(goals).where(and(eq(goals.userId, userId), isNotNull(goals.completedAt))),
    db.select({ completedAt: todos.completedAt }).from(todos).where(and(eq(todos.userId, userId), isNotNull(todos.completedAt))),
    db.select({ occurredAt: events.occurredAt, durationMs: events.durationMs }).from(events).where(and(eq(events.userId, userId), eq(events.source, 'manual'))),
  ]);

  // Number of day- or month-buckets from account creation ("since you started Baseline")
  // to today, inclusive — the denominator for the all-time average.
  const startKey = userRow[0] ? dayKeyInTz(userRow[0].createdAt, tz) : todayKey;
  const spanCount = (unit: 'day' | 'month'): number => {
    const [fy, fm, fd] = startKey.split('-').map(Number);
    const [ty, tm, td] = todayKey.split('-').map(Number);
    if (unit === 'month') return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
    return Math.max(1, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1);
  };

  const allHours = round1(allEntries.reduce((a, r) => a + (r.durationMs ?? 0), 0) / HOUR_MS);
  const activeDaysAll = new Set(allEntries.map((r) => dayKeyInTz(r.occurredAt, tz))).size;
  const bucketsAll = spanCount(granularity);
  const daysAll = spanCount('day'); // tracked-days reads as a % of all days since joining

  // value, delta, unit + the all-time baseline (expected, and the total ÷ buckets behind it).
  const mk = (cv: number, pv: number, unit: string, expected: number, total: number, buckets: number) => ({
    value: cv,
    delta: computeDelta(cv, pv),
    unit,
    expected,
    expectedTotal: total,
    expectedBuckets: buckets,
  });

  return NextResponse.json({
    period: periodParam,
    since: startKey, // account-creation day (YYYY-MM-DD) the baseline is measured from
    metrics: {
      goals_completed: mk(gCurr.length, gPrev.length, 'goals', allGoals.length ? round1(allGoals.length / bucketsAll) : 0, allGoals.length, bucketsAll),
      tasks_completed: mk(tCurr.length, tPrev.length, 'tasks', allTasks.length ? round1(allTasks.length / bucketsAll) : 0, allTasks.length, bucketsAll),
      hours_tracked: mk(round1(hours(eCurr)), round1(hours(ePrev)), 'hrs', allEntries.length ? round1(allHours / bucketsAll) : 0, allHours, bucketsAll),
      tracked_days: mk(distinctDays(eCurr, tz), distinctDays(ePrev, tz), 'days', allEntries.length ? round1(activeDaysAll / bucketsAll) : 0, activeDaysAll, daysAll),
    },
  });
}
