import { zonedCivilToUtc } from '@baseline/metrics';

// Resolve a time-entry request's instant. A plain local `date` (YYYY-MM-DD) is
// anchored at noon in the user's timezone — so the entry lands on that local day
// regardless of UTC offset. A full `occurred_at` ISO timestamp (e.g. a timer's end
// time) is used as-is.
export function resolveOccurredAt(
  body: { date?: string; occurred_at?: string },
  tz: string,
): Date | null {
  if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    const [y, m, d] = body.date.split('-').map(Number);
    return zonedCivilToUtc(y, m, d, 12, tz);
  }
  if (body.occurred_at) {
    const d = new Date(body.occurred_at);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Parse a naive local datetime ("YYYY-MM-DDTHH:mm", as from a datetime-local input)
// as wall-clock time in `tz` and return the UTC instant.
function parseZonedDateTime(s: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const dt = zonedCivilToUtc(y, mo, d, h, tz, mi);
  return isNaN(dt.getTime()) ? null : dt;
}

const HOUR_MS = 60 * 60 * 1000;

export interface EntryTiming {
  occurredAt: Date; // the entry's end instant
  durationMs: number;
  timed: boolean; // true when a real start/end range is known
}

// Resolve an entry's end instant + duration from the request body. Priority:
//   1. `from`/`to` datetime range (minute precision, in the user's tz) — the real
//      start/end; hours are derived from it and the entry is marked timed.
//   2. `occurred_at` + `hours` (e.g. a live timer's end) — kept as given.
//   3. `date` + `hours` — anchored at noon in tz (legacy quick entry).
export function resolveEntryTiming(
  body: { from?: string; to?: string; occurred_at?: string; date?: string; hours?: number; timed?: boolean },
  tz: string,
): EntryTiming | { error: 'INVALID_DATE' | 'INVALID_RANGE' | 'INVALID_HOURS' } {
  if (typeof body.from === 'string' && typeof body.to === 'string') {
    const from = parseZonedDateTime(body.from, tz);
    const to = parseZonedDateTime(body.to, tz);
    if (!from || !to) return { error: 'INVALID_DATE' };
    const durationMs = to.getTime() - from.getTime();
    if (durationMs <= 0) return { error: 'INVALID_RANGE' };
    return { occurredAt: to, durationMs, timed: true };
  }

  const occurredAt = resolveOccurredAt(body, tz);
  if (!occurredAt || isNaN(occurredAt.getTime())) return { error: 'INVALID_DATE' };
  if (typeof body.hours !== 'number' || !(body.hours > 0)) return { error: 'INVALID_HOURS' };
  return { occurredAt, durationMs: Math.round(body.hours * HOUR_MS), timed: body.timed === true };
}
