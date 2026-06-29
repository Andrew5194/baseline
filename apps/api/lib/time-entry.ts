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
