// Calendar-aligned periods for the Overview: this week / month / year. Unlike the
// trailing windows (7d/30d/90d), these start at the period boundary so a bar chart
// spanning the full period shows where today falls within it.

export type Period = 'week' | 'month' | 'year';

const DAY_MS = 24 * 60 * 60 * 1000;

export function isPeriod(v: string): v is Period {
  return v === 'week' || v === 'month' || v === 'year';
}

export function endOfTodayUTC(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

// Monday-anchored start of the week containing `now` (UTC, midnight).
function startOfWeek(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d;
}

export interface PeriodBounds {
  start: Date; // inclusive
  end: Date; // exclusive (start of next period)
  prevStart: Date; // start of the previous period (prevEnd === start)
  granularity: 'day' | 'month';
  days: number; // calendar days in the period
  budgetHours: number; // 24 * days
}

export function periodBounds(period: Period, now: Date): PeriodBounds {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let start: Date;
  let end: Date;
  let prevStart: Date;
  let granularity: 'day' | 'month';

  if (period === 'week') {
    start = startOfWeek(now);
    end = new Date(start.getTime() + 7 * DAY_MS);
    prevStart = new Date(start.getTime() - 7 * DAY_MS);
    granularity = 'day';
  } else if (period === 'month') {
    start = new Date(Date.UTC(y, m, 1));
    end = new Date(Date.UTC(y, m + 1, 1));
    prevStart = new Date(Date.UTC(y, m - 1, 1));
    granularity = 'day';
  } else {
    start = new Date(Date.UTC(y, 0, 1));
    end = new Date(Date.UTC(y + 1, 0, 1));
    prevStart = new Date(Date.UTC(y - 1, 0, 1));
    granularity = 'month';
  }

  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return { start, end, prevStart, granularity, days, budgetHours: days * 24 };
}

// Buckets covering [start, end): daily for week/month, monthly (Jan…Dec) for year.
export function periodBuckets(period: Period, start: Date, end: Date): Array<{ start: Date; end: Date }> {
  const out: Array<{ start: Date; end: Date }> = [];
  if (period === 'year') {
    const y = start.getUTCFullYear();
    for (let mm = 0; mm < 12; mm++) {
      out.push({ start: new Date(Date.UTC(y, mm, 1)), end: new Date(Date.UTC(y, mm + 1, 1)) });
    }
  } else {
    let cursor = new Date(start);
    while (cursor.getTime() < end.getTime()) {
      const next = new Date(cursor.getTime() + DAY_MS);
      out.push({ start: new Date(cursor), end: next });
      cursor = next;
    }
  }
  return out;
}
