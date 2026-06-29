'use client';

import { colorForCategory } from '../../lib/categories';

interface CalendarAllocationProps {
  // Same rows as the bar chart: { date, [category]: hours, Free }.
  data: Array<Record<string, number | string>>;
  categories: string[];
  colorOf?: (c: string) => string;
  // 'month' = year view (one cell per month); 'day' = week/month view.
  granularity: 'day' | 'month';
  recurringCategories?: string[];
  freeFocus?: boolean;
  todayISO?: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Monday-anchored weekday index (0 = Mon … 6 = Sun) for a YYYY-MM-DD date.
const mondayIndex = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

export function CalendarAllocation({
  data,
  categories,
  colorOf,
  granularity,
  recurringCategories,
  freeFocus,
  todayISO,
}: CalendarAllocationProps) {
  const color = colorOf ?? ((c: string) => colorForCategory(c));
  const recurringSet = new Set(recurringCategories ?? []);
  const visibleCats = categories.filter((c) => !(freeFocus && recurringSet.has(c)));
  const isYear = granularity === 'month';

  // A day is 24h; a month cell (year view) is 24 × days-in-month. When focusing on
  // free time, drop the routines from the capacity.
  const capacity = (date: string, row: Record<string, number | string>) => {
    const [y, m] = date.split('-').map(Number);
    const base = isYear ? 24 * new Date(Date.UTC(y, m, 0)).getUTCDate() : 24;
    if (!freeFocus) return base;
    const rec = categories.filter((c) => recurringSet.has(c)).reduce((s, c) => s + (Number(row[c]) || 0), 0);
    return Math.max(1, base - rec);
  };

  const Segments = ({ row, date }: { row?: Record<string, number | string>; date: string }) => {
    if (!row) return <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800" />;
    const cap = capacity(date, row);
    const segs = visibleCats
      .map((c) => ({ c, frac: Math.min(1, (Number(row[c]) || 0) / cap) }))
      .filter((s) => s.frac > 0.001);
    return (
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {segs.map((s) => (
          <div
            key={s.c}
            style={{ width: `${s.frac * 100}%`, backgroundColor: color(s.c) }}
            title={`${s.c}: ${(Number(row[s.c]) || 0).toFixed(1)}h`}
          />
        ))}
      </div>
    );
  };

  // ── Year: one cell per month ───────────────────────────────────────────────
  if (isYear) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {data.map((r) => {
          const date = String(r.date);
          const [, m] = date.split('-').map(Number);
          const current = todayISO === date;
          return (
            <div
              key={date}
              className={`rounded-lg border p-3 flex flex-col gap-2.5 ${
                current ? 'border-emerald-400 dark:border-emerald-500/50' : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <p className={`text-xs font-medium ${current ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-300'}`}>
                {MONTHS[m - 1]}
              </p>
              <div className="mt-auto">
                <Segments row={r} date={date} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Week / Month: one cell per day ─────────────────────────────────────────
  const byDate = new Map(data.map((r) => [String(r.date), r]));
  const dates = data.map((r) => String(r.date)).sort();
  const isWeek = dates.length <= 7;
  const lead = !isWeek && dates.length ? mondayIndex(dates[0]) : 0;

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 mb-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 text-center">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {dates.map((date) => {
          const d = Number(date.split('-')[2]);
          const row = byDate.get(date);
          const today = todayISO === date;
          return (
            <div
              key={date}
              className={`rounded-lg border p-2 flex flex-col gap-2 min-h-[54px] ${
                today ? 'border-emerald-400 dark:border-emerald-500/50' : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <span className={`text-[11px] tabular-nums ${today ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {d}
              </span>
              <div className="mt-auto">
                <Segments row={row} date={date} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
