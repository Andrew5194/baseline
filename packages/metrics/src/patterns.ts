import type { EventInput } from './types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Distribution of commits across days of the week.
 * Returns an array of { day, count } for each day.
 */
export function dayOfWeekDistributionV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): Array<{ day: string; count: number }> {
  const counts = new Array(7).fill(0);

  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      counts[e.occurredAt.getDay()]++;
    }
  }

  return DAY_NAMES.map((day, i) => ({ day, count: counts[i] }));
}

/**
 * Distribution of commits across hours of the day (0-23).
 * Returns an array of { hour, count }.
 */
export function hourOfDayDistributionV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): Array<{ hour: number; count: number }> {
  const counts = new Array(24).fill(0);

  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      counts[e.occurredAt.getHours()]++;
    }
  }

  return counts.map((count, hour) => ({ hour, count }));
}

/**
 * Identifies the most productive day of the week (highest commit count).
 */
export function peakDayV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): string | null {
  const dist = dayOfWeekDistributionV1(events, windowStart, windowEnd);
  const max = dist.reduce((a, b) => (b.count > a.count ? b : a), dist[0]);
  return max.count > 0 ? max.day : null;
}
