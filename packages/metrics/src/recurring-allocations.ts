import type { EventInput } from './types';
import { startOfDayInTz, addLocalDays, weekdayInTz } from './tz';

const HOUR_MS = 1000 * 60 * 60;

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
  timeZone = 'UTC',
): EventInput[] {
  if (allocations.length === 0) return [];

  const out: EventInput[] = [];
  // Iterate local calendar days from the day containing windowStart.
  let dayStart = startOfDayInTz(windowStart, timeZone);

  while (dayStart.getTime() < windowEnd.getTime()) {
    const weekday = weekdayInTz(dayStart, timeZone);
    // Local noon — safely inside the day, lands in the day's bucket.
    const occurredAt = new Date(dayStart.getTime() + 12 * HOUR_MS);
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
    dayStart = addLocalDays(dayStart, 1, timeZone);
  }

  return out;
}
