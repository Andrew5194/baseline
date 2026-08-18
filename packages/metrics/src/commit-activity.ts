import type { EventInput } from './types';
import { dayKeyInTz } from './tz';
import { longestDayStreak } from './streak';

/**
 * Counts commits in the window.
 */
export function commitCountV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  return events.filter(
    (e) =>
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd,
  ).length;
}

/**
 * Counts days with at least one commit in the window, bucketed by the user's
 * local calendar day (`timeZone`, defaults to UTC).
 */
export function activeDaysV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
  timeZone = 'UTC',
): number {
  const days = new Set<string>();
  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      days.add(dayKeyInTz(e.occurredAt, timeZone));
    }
  }
  return days.size;
}

/**
 * Longest consecutive streak of local-calendar days with commits.
 */
export function streakDaysV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
  timeZone = 'UTC',
): number {
  const days = new Set<string>();
  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      days.add(dayKeyInTz(e.occurredAt, timeZone));
    }
  }

  return longestDayStreak(days);
}
