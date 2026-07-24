// Calendar-aligned periods for the Overview: this week / month / year. Unlike the
// trailing windows (7d/30d/90d), these start at the period boundary so a full-period
// bar chart shows where today falls within it.
//
// Boundaries are computed in the user's local timezone (`tz`, IANA) and returned as
// the UTC instants the DB filters on — so a "day" is the local calendar day, not UTC.

import { partsInTz, zonedCivilToUtc, addLocalDays, startOfDayInTz } from '@baseline/metrics';

export type Period = 'week' | 'month' | 'year';

const DAY_MS = 24 * 60 * 60 * 1000;

export function isPeriod(v: string): v is Period {
  return v === 'week' || v === 'month' || v === 'year';
}

// A reference instant inside the period that sits `offset` periods before the one
// containing `now` (offset 0 = current). Feed the result to periodBounds() to look
// at past weeks/months/years; keep the real `now` for any period-to-date clamping.
export function offsetNow(period: Period, now: Date, tz: string, offset: number): Date {
  if (!offset || offset < 0) return now;
  const { year, month } = partsInTz(now, tz);
  if (period === 'week') return addLocalDays(now, -7 * offset, tz);
  if (period === 'month') return zonedCivilToUtc(year, month - offset, 15, 0, tz);
  return zonedCivilToUtc(year - offset, 7, 1, 0, tz);
}

// Parse a non-negative integer `offset` query param (0 when absent/invalid).
export function parseOffset(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// UTC instant of the start of the next local day after `now` (exclusive end of "today").
export function endOfToday(now: Date, tz: string): Date {
  return addLocalDays(startOfDayInTz(now, tz), 1, tz);
}

// Monday-anchored start of the local week containing `now`, as a UTC instant.
function startOfWeek(now: Date, tz: string): Date {
  const { weekday } = partsInTz(now, tz);
  const sinceMonday = (weekday + 6) % 7;
  return addLocalDays(startOfDayInTz(now, tz), -sinceMonday, tz);
}

export interface PeriodBounds {
  start: Date; // inclusive
  end: Date; // exclusive (start of next period)
  prevStart: Date; // start of the previous period (prevEnd === start)
  granularity: 'day' | 'month';
  days: number; // calendar days in the period
  budgetHours: number; // 24 * days
}

export function periodBounds(period: Period, now: Date, tz: string): PeriodBounds {
  const { year, month } = partsInTz(now, tz);
  let start: Date;
  let end: Date;
  let prevStart: Date;
  let granularity: 'day' | 'month';

  if (period === 'week') {
    start = startOfWeek(now, tz);
    end = addLocalDays(start, 7, tz);
    prevStart = addLocalDays(start, -7, tz);
    granularity = 'day';
  } else if (period === 'month') {
    // zonedCivilToUtc passes month-1 to Date.UTC, which normalizes overflow
    // (month+1 → next year's January, month-1 → previous December).
    start = zonedCivilToUtc(year, month, 1, 0, tz);
    end = zonedCivilToUtc(year, month + 1, 1, 0, tz);
    prevStart = zonedCivilToUtc(year, month - 1, 1, 0, tz);
    granularity = 'day';
  } else {
    start = zonedCivilToUtc(year, 1, 1, 0, tz);
    end = zonedCivilToUtc(year + 1, 1, 1, 0, tz);
    prevStart = zonedCivilToUtc(year - 1, 1, 1, 0, tz);
    granularity = 'month';
  }

  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return { start, end, prevStart, granularity, days, budgetHours: days * 24 };
}

// Buckets covering [start, end): one per local day for week/month, monthly
// (Jan…Dec) for year. Each bucket is a UTC-instant range aligned to local days.
export function periodBuckets(
  period: Period,
  start: Date,
  end: Date,
  tz: string,
): Array<{ start: Date; end: Date }> {
  const out: Array<{ start: Date; end: Date }> = [];
  if (period === 'year') {
    const { year } = partsInTz(start, tz);
    for (let mm = 1; mm <= 12; mm++) {
      out.push({
        start: zonedCivilToUtc(year, mm, 1, 0, tz),
        end: zonedCivilToUtc(year, mm + 1, 1, 0, tz),
      });
    }
  } else {
    let cursor = start;
    while (cursor.getTime() < end.getTime()) {
      const next = addLocalDays(cursor, 1, tz);
      out.push({ start: cursor, end: next });
      cursor = next;
    }
  }
  return out;
}
