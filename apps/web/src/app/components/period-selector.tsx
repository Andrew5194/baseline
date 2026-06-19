'use client';

export type Period = 'week' | 'month' | 'year';

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

interface PeriodSelectorProps {
  value: Period;
  onChange: (value: Period) => void;
}

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// Monday-anchored start of the current week, in UTC to match the API's period bounds.
function startOfWeekUTC(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d;
}

// Human label for the current period: a date range for the week, the month name,
// or the year — e.g. "June 1st – June 7th", "June", "2026".
export function periodRangeLabel(period: Period): string {
  const now = new Date();
  if (period === 'year') return String(now.getUTCFullYear());
  if (period === 'month') return MONTHS_FULL[now.getUTCMonth()];
  const start = startOfWeekUTC(now);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => `${MONTHS_FULL[d.getUTCMonth()]} ${ordinal(d.getUTCDate())}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === p.value
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
