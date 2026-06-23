import type { EventInput } from './types';
import { weekdayInTz, hourInTz } from './tz';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Distribution of commits across days of the week, in the user's local timezone
 * (`timeZone`, defaults to UTC). Returns an array of { day, count } for each day.
 */
export function dayOfWeekDistributionV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
  timeZone = 'UTC',
): Array<{ day: string; count: number }> {
  const counts = new Array(7).fill(0);

  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      counts[weekdayInTz(e.occurredAt, timeZone)]++;
    }
  }

  return DAY_NAMES.map((day, i) => ({ day, count: counts[i] }));
}

/**
 * Distribution of commits across hours of the day (0-23), in the user's local
 * timezone. Returns an array of { hour, count }.
 */
export function hourOfDayDistributionV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
  timeZone = 'UTC',
): Array<{ hour: number; count: number }> {
  const counts = new Array(24).fill(0);

  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      counts[hourInTz(e.occurredAt, timeZone)]++;
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
  timeZone = 'UTC',
): string | null {
  const dist = dayOfWeekDistributionV1(events, windowStart, windowEnd, timeZone);
  const max = dist.reduce((a, b) => (b.count > a.count ? b : a), dist[0]);
  return max.count > 0 ? max.day : null;
}
