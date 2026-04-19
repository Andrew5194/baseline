import type { EventInput } from './types';

/**
 * Measures consistency of daily output over the window.
 * Returns a score from 0-100 where 100 = committed every day equally,
 * 0 = all commits on one day.
 *
 * Uses coefficient of variation (lower CV = more consistent).
 * Score = max(0, 100 - CV * 100), capped at 100.
 */
export function consistencyScoreV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const dailyCounts: Record<string, number> = {};

  // Initialize all days in the window
  const cursor = new Date(windowStart);
  while (cursor < windowEnd) {
    dailyCounts[cursor.toISOString().split('T')[0]] = 0;
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      const day = e.occurredAt.toISOString().split('T')[0];
      if (day in dailyCounts) {
        dailyCounts[day]++;
      }
    }
  }

  const values = Object.values(dailyCounts);
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  return Math.round(Math.max(0, Math.min(100, 100 - cv * 50)));
}

/**
 * Counts "deep work days" — days with 2+ hours of focused commit activity
 * (same logic as focus hours but counted per day).
 */
export function deepWorkDaysV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  // Group commits by day
  const byDay: Record<string, Date[]> = {};
  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      const day = e.occurredAt.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(e.occurredAt);
    }
  }

  let deepDays = 0;

  for (const times of Object.values(byDay)) {
    times.sort((a, b) => a.getTime() - b.getTime());

    // Find the longest block of commits within 2-hour gaps
    let blockStart = times[0].getTime();
    let blockEnd = blockStart;

    let maxBlockHours = 0;

    for (let i = 1; i < times.length; i++) {
      const t = times[i].getTime();
      if (t - blockEnd <= TWO_HOURS_MS) {
        blockEnd = t;
      } else {
        maxBlockHours = Math.max(maxBlockHours, (blockEnd - blockStart) / (1000 * 60 * 60));
        blockStart = t;
        blockEnd = t;
      }
    }
    maxBlockHours = Math.max(maxBlockHours, (blockEnd - blockStart) / (1000 * 60 * 60));

    if (maxBlockHours >= 2) {
      deepDays++;
    }
  }

  return deepDays;
}
