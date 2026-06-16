import type { EventInput } from './types';

const HOUR_MS = 1000 * 60 * 60;

/**
 * Category an event's hours count toward. Manual entries carry `payload.category`;
 * calendar events default to "Meetings"; anything else falls back to "Other".
 */
function categoryOf(e: EventInput): string {
  const fromPayload = e.payload?.category;
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload.trim();
  if (e.source === 'google_calendar') return 'Meetings';
  return 'Other';
}

/**
 * Hours allocated per category from duration-bearing events in [start, end).
 * Hours are summed from `durationMs` and rounded to one decimal.
 */
export function hoursByCategoryV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const e of events) {
    if (!e.durationMs || e.durationMs <= 0) continue;
    if (e.occurredAt < windowStart || e.occurredAt >= windowEnd) continue;
    const category = categoryOf(e);
    totals[category] = (totals[category] ?? 0) + e.durationMs / HOUR_MS;
  }

  for (const key of Object.keys(totals)) {
    totals[key] = Math.round(totals[key] * 10) / 10;
  }
  return totals;
}
