import { NextRequest, NextResponse } from 'next/server';
import { db, events, goals, todos } from '@baseline/db';
import { eq, and, gte, lt, asc } from 'drizzle-orm';
import { zonedCivilToUtc } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';

const HOUR_MS = 3_600_000;
const METRICS = ['goals_completed', 'tasks_completed', 'hours_tracked', 'tracked_days'];

// A date-only 'YYYY-MM-DD' resolved to that calendar day's start in the user's tz.
function parseBoundary(v: string | null, tz: string): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, mo, d] = v.split('-').map(Number);
  return zonedCivilToUtc(y, mo, d, 0, tz);
}

// GET /v1/metrics/baseline/items?metric=&since=&until= — the granular records behind
// a Baseline bar: goals or tasks completed, or time entries, in [since, until).
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const params = request.nextUrl.searchParams;
  const metric = params.get('metric') || '';
  const since = parseBoundary(params.get('since'), tz);
  const until = parseBoundary(params.get('until'), tz);

  if (!METRICS.includes(metric)) {
    return NextResponse.json({ error: 'Invalid metric', code: 'INVALID_METRIC' }, { status: 400 });
  }
  if (!since || !until) {
    return NextResponse.json({ error: 'Invalid range', code: 'INVALID_RANGE' }, { status: 400 });
  }

  if (metric === 'goals_completed' || metric === 'tasks_completed') {
    const table = metric === 'goals_completed' ? goals : todos;
    const rows = await db
      .select({ id: table.id, title: table.title, completedAt: table.completedAt, category: table.category })
      .from(table)
      .where(and(eq(table.userId, userId), gte(table.completedAt, since), lt(table.completedAt, until)))
      .orderBy(asc(table.completedAt));
    const items = rows.map((r) => ({ id: r.id, title: r.title, completed_at: r.completedAt, category: r.category }));
    return NextResponse.json({ metric, kind: metric === 'goals_completed' ? 'goals' : 'tasks', items });
  }

  // hours_tracked / tracked_days — the manual time entries in range.
  const rows = await db
    .select({ id: events.id, occurredAt: events.occurredAt, durationMs: events.durationMs, payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.source, 'manual'), gte(events.occurredAt, since), lt(events.occurredAt, until)))
    .orderBy(asc(events.occurredAt));
  const items = rows.map((r) => {
    const p = (r.payload ?? {}) as { category?: string; note?: string };
    return {
      id: r.id,
      occurred_at: r.occurredAt,
      hours: Math.round(((r.durationMs ?? 0) / HOUR_MS) * 100) / 100,
      category: p.category ?? null,
      note: p.note ?? null,
    };
  });
  return NextResponse.json({ metric, kind: 'entries', items });
}
