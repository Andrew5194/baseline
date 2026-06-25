import { NextRequest, NextResponse } from 'next/server';
import { db, goals, events } from '@baseline/db';
import { eq, and, gte } from 'drizzle-orm';
import type { EventInput } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../lib/user';
import {
  computeGoalProgress,
  goalsLookbackStart,
  GITHUB_METRICS,
  type GoalRow,
  type Cadence,
} from '../../../lib/goals';

const CADENCES = ['day', 'week', 'month', 'year'] as const;
const CADENCE_ADVERB: Record<Cadence, string> = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };
const PERIOD_LABEL: Record<Cadence, string> = { day: 'today', week: 'this week', month: 'this month', year: 'this year' };
const GITHUB_META: Record<string, { unit: string; label: string }> = {
  commits: { unit: 'commits', label: 'commits' },
  prs_merged: { unit: 'PRs', label: 'PRs merged' },
  reviews: { unit: 'reviews', label: 'reviews' },
  active_days: { unit: 'days', label: 'active days' },
};

function unitOf(g: GoalRow): string {
  return g.type === 'time' ? 'h' : GITHUB_META[g.metric]?.unit ?? '';
}

// Human title, e.g. "1h Coding · daily" or "5 PRs merged · weekly".
function titleOf(g: GoalRow): string {
  const cad = CADENCE_ADVERB[g.cadence];
  if (g.type === 'time') return `${g.target}h ${g.category} · ${cad}`;
  return `${g.target} ${GITHUB_META[g.metric]?.label ?? g.metric} · ${cad}`;
}

function toDto(g: GoalRow, ei: EventInput[], now: Date, tz: string) {
  const p = computeGoalProgress(g, ei, now, tz);
  return {
    id: g.id,
    type: g.type,
    metric: g.metric,
    category: g.category,
    target: g.target,
    cadence: g.cadence,
    title: titleOf(g),
    unit: unitOf(g),
    period_label: PERIOD_LABEL[g.cadence],
    current: p.current,
    met: p.met,
    pct: p.pct,
    streak: p.streak,
  };
}

// GET /v1/goals — the user's goals with current-period progress and streaks.
export async function GET() {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const now = new Date();

  const rows = (await db
    .select({
      id: goals.id,
      type: goals.type,
      metric: goals.metric,
      category: goals.category,
      target: goals.target,
      cadence: goals.cadence,
      createdAt: goals.createdAt,
    })
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt)) as Array<GoalRow & { createdAt: Date }>;

  if (rows.length === 0) return NextResponse.json({ data: [] });

  // One event fetch covering the deepest streak lookback across all goals.
  const since = goalsLookbackStart(rows, now, tz);
  const eventRows = await db
    .select({
      eventType: events.eventType,
      occurredAt: events.occurredAt,
      payload: events.payload,
      durationMs: events.durationMs,
      source: events.source,
    })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.occurredAt, since)));

  const ei: EventInput[] = eventRows.map((r) => ({
    eventType: r.eventType,
    occurredAt: r.occurredAt,
    payload: r.payload as Record<string, unknown> | null,
    durationMs: r.durationMs,
    source: r.source,
  }));

  return NextResponse.json({ data: rows.map((g) => toDto(g, ei, now, tz)) });
}

// POST /v1/goals — create a goal.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: {
    type?: string;
    metric?: string;
    category?: string;
    target?: number;
    cadence?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const cadence = body.cadence ?? '';
  if (!CADENCES.includes(cadence as Cadence)) {
    return NextResponse.json({ error: 'cadence must be day, week, or month', code: 'INVALID_CADENCE' }, { status: 400 });
  }
  if (typeof body.target !== 'number' || !(body.target > 0)) {
    return NextResponse.json({ error: 'target must be greater than 0', code: 'INVALID_TARGET' }, { status: 400 });
  }

  let type: string;
  let metric: string;
  let category: string | null;

  if (body.type === 'time') {
    type = 'time';
    metric = 'hours';
    category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category) {
      return NextResponse.json({ error: 'category is required for time goals', code: 'INVALID_CATEGORY' }, { status: 400 });
    }
    // Cap hours at the period's total available time (24h × days in the period).
    const maxHours: Record<Cadence, number> = { day: 24, week: 168, month: 744, year: 8784 };
    if (body.target > maxHours[cadence as Cadence]) {
      return NextResponse.json(
        { error: `hours target cannot exceed ${maxHours[cadence as Cadence]} for a ${cadence} goal`, code: 'INVALID_TARGET' },
        { status: 400 },
      );
    }
  } else if (body.type === 'github') {
    type = 'github';
    if (!GITHUB_METRICS.includes(body.metric as (typeof GITHUB_METRICS)[number])) {
      return NextResponse.json({ error: 'invalid github metric', code: 'INVALID_METRIC' }, { status: 400 });
    }
    metric = body.metric!;
    category = null;
  } else {
    return NextResponse.json({ error: 'type must be time or github', code: 'INVALID_TYPE' }, { status: 400 });
  }

  const [row] = await db
    .insert(goals)
    .values({ userId, type, metric, category, target: body.target, cadence })
    .returning({
      id: goals.id,
      type: goals.type,
      metric: goals.metric,
      category: goals.category,
      target: goals.target,
      cadence: goals.cadence,
    });

  const tz = await getUserTimezone(userId);
  return NextResponse.json(toDto(row as GoalRow, [], new Date(), tz), { status: 201 });
}
