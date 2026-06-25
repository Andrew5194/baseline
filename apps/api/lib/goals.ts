// Goal progress engine. Goals store only a definition (metric + target + cadence);
// progress and streaks are computed on read from the user's events, bucketed into
// the cadence's local-calendar periods (timezone-aware, matching the dashboard).

import {
  commitCountV1,
  throughputTasksV1,
  reviewCountV1,
  activeDaysV1,
  hoursByCategoryV1,
  startOfDayInTz,
  addLocalDays,
  zonedCivilToUtc,
  partsInTz,
} from '@baseline/metrics';
import type { EventInput } from '@baseline/metrics';

export type Cadence = 'day' | 'week' | 'month' | 'year';
export type GoalType = 'time' | 'github';
export const GITHUB_METRICS = ['commits', 'prs_merged', 'reviews', 'active_days'] as const;
export type GithubMetric = (typeof GITHUB_METRICS)[number];

export interface GoalRow {
  id: string;
  type: GoalType;
  metric: string; // github metric key, or 'hours' for time goals
  category: string | null;
  target: number;
  cadence: Cadence;
}

export interface GoalProgress {
  current: number; // value so far this period
  target: number;
  met: boolean;
  pct: number; // 0–100, clamped
  streak: number; // consecutive periods met (current counts only once met)
}

// How many periods back to scan when computing a streak.
const STREAK_LOOKBACK: Record<Cadence, number> = { day: 180, week: 52, month: 24, year: 5 };

const round1 = (n: number) => Math.round(n * 10) / 10;
const isCadence = (v: string): v is Cadence =>
  v === 'day' || v === 'week' || v === 'month' || v === 'year';

// UTC instant of the start of the cadence period containing `instant`.
function periodStart(cadence: Cadence, instant: Date, tz: string): Date {
  if (cadence === 'day') return startOfDayInTz(instant, tz);
  if (cadence === 'week') {
    const { weekday } = partsInTz(instant, tz);
    const sinceMonday = (weekday + 6) % 7; // Monday-anchored
    return addLocalDays(startOfDayInTz(instant, tz), -sinceMonday, tz);
  }
  const { year, month } = partsInTz(instant, tz);
  if (cadence === 'year') return zonedCivilToUtc(year, 1, 1, 0, tz);
  return zonedCivilToUtc(year, month, 1, 0, tz);
}

// UTC instant of the start of the period `n` periods before the current one.
function periodStartBack(cadence: Cadence, instant: Date, tz: string, n: number): Date {
  const cur = periodStart(cadence, instant, tz);
  if (n === 0) return cur;
  if (cadence === 'day') return addLocalDays(cur, -n, tz);
  if (cadence === 'week') return addLocalDays(cur, -7 * n, tz);
  const { year, month } = partsInTz(cur, tz);
  if (cadence === 'year') return zonedCivilToUtc(year - n, 1, 1, 0, tz);
  return zonedCivilToUtc(year, month - n, 1, 0, tz); // Date.UTC normalizes the month
}

// UTC instant of the end (exclusive) of the period starting at `start`.
function periodEnd(cadence: Cadence, start: Date, tz: string): Date {
  if (cadence === 'day') return addLocalDays(start, 1, tz);
  if (cadence === 'week') return addLocalDays(start, 7, tz);
  const { year, month } = partsInTz(start, tz);
  if (cadence === 'year') return zonedCivilToUtc(year + 1, 1, 1, 0, tz);
  return zonedCivilToUtc(year, month + 1, 1, 0, tz);
}

// The goal's measured value over [start, end).
function goalValue(goal: GoalRow, events: EventInput[], start: Date, end: Date, tz: string): number {
  if (goal.type === 'time') {
    return hoursByCategoryV1(events, start, end)[goal.category ?? ''] ?? 0;
  }
  switch (goal.metric) {
    case 'commits':
      return commitCountV1(events, start, end);
    case 'prs_merged':
      return throughputTasksV1(events, start, end);
    case 'reviews':
      return reviewCountV1(events, start, end);
    case 'active_days':
      return activeDaysV1(events, start, end, tz);
    default:
      return 0;
  }
}

// The earliest event timestamp needed to evaluate `goals` (for the DB query bound).
export function goalsLookbackStart(goals: GoalRow[], now: Date, tz: string): Date {
  let earliest = now;
  for (const g of goals) {
    if (!isCadence(g.cadence)) continue;
    const s = periodStartBack(g.cadence, now, tz, STREAK_LOOKBACK[g.cadence] - 1);
    if (s < earliest) earliest = s;
  }
  return earliest;
}

export function computeGoalProgress(goal: GoalRow, events: EventInput[], now: Date, tz: string): GoalProgress {
  const cadence = isCadence(goal.cadence) ? goal.cadence : 'day';
  const curStart = periodStart(cadence, now, tz);
  const curEnd = periodEnd(cadence, curStart, tz);
  const current = goalValue(goal, events, curStart, now < curEnd ? now : curEnd, tz);
  const met = current >= goal.target;
  const pct = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;

  // Consecutive met periods ending now. The current period is in-progress, so it
  // only adds to the streak once met — but not yet meeting it doesn't break a
  // streak earned through yesterday/last period.
  let streak = 0;
  for (let n = 0; n < STREAK_LOOKBACK[cadence]; n++) {
    const s = periodStartBack(cadence, now, tz, n);
    const e = periodEnd(cadence, s, tz);
    const isCurrent = n === 0;
    const val = goalValue(goal, events, s, isCurrent && now < e ? now : e, tz);
    if (val >= goal.target) streak++;
    else if (isCurrent) continue;
    else break;
  }

  return { current: goal.type === 'time' ? round1(current) : current, target: goal.target, met, pct, streak };
}
