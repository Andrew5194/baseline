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

// Today's local calendar date in `timeZone`, as a UTC-midnight Date carrying the
// right Y/M/D (so day arithmetic with getUTC*/setUTC* stays on the local date).
function localToday(timeZone: string): Date {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // YYYY-MM-DD
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Human label for the current period in the user's timezone: a date range for the
// week, the month name, or the year — e.g. "June 1st – June 7th", "June", "2026".
export function periodRangeLabel(period: Period, timeZone = 'UTC'): string {
  const today = localToday(timeZone);
  if (period === 'year') return String(today.getUTCFullYear());
  if (period === 'month') return MONTHS_FULL[today.getUTCMonth()];
  const start = new Date(today);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  start.setUTCDate(today.getUTCDate() - sinceMonday);
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
