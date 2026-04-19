import type { EventInput } from './types';

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
 * Counts days with at least one commit in the window.
 */
export function activeDaysV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const days = new Set<string>();
  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      days.add(e.occurredAt.toISOString().split('T')[0]);
    }
  }
  return days.size;
}

/**
 * Longest consecutive streak of days with commits.
 */
export function streakDaysV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const days = new Set<string>();
  for (const e of events) {
    if (
      e.eventType === 'github.commit.pushed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd
    ) {
      days.add(e.occurredAt.toISOString().split('T')[0]);
    }
  }

  if (days.size === 0) return 0;

  const sorted = Array.from(days).sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}
