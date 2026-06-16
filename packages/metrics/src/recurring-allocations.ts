import type { EventInput } from './types';

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = 24 * HOUR_MS;

export interface RecurringAllocationInput {
  category: string;
  durationMs: number;
  // Bitmask of weekdays (bit i => weekday i, 0=Sun … 6=Sat). 127 = every day.
  daysMask: number;
}

/**
 * Expand standing recurring allocations into synthetic per-day events across
 * [windowStart, windowEnd). One event is emitted per allocation per matching
 * calendar day (anchored at noon UTC so it lands inside the day's bucket), so
 * the existing `hoursByCategoryV1` aggregation counts them like real entries.
 */
export function recurringToEvents(
  allocations: RecurringAllocationInput[],
  windowStart: Date,
  windowEnd: Date,
): EventInput[] {
  if (allocations.length === 0) return [];

  const out: EventInput[] = [];
  // Iterate calendar days from the UTC date of windowStart.
  const day = new Date(
    Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate()),
  );

  while (day.getTime() < windowEnd.getTime()) {
    const weekday = day.getUTCDay();
    const occurredAt = new Date(day.getTime() + 12 * HOUR_MS); // noon, safely inside the day
    if (occurredAt >= windowStart && occurredAt < windowEnd) {
      for (const a of allocations) {
        if (!(a.durationMs > 0)) continue;
        if ((a.daysMask & (1 << weekday)) === 0) continue;
        out.push({
          eventType: 'recurring.allocation',
          occurredAt,
          payload: { category: a.category },
          durationMs: a.durationMs,
          source: 'recurring',
        });
      }
    }
    day.setTime(day.getTime() + DAY_MS);
  }

  return out;
}
