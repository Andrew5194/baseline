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

// Today's local calendar date in `timeZone` as a UTC-midnight Date carrying the right
// Y/M/D, so getUTC*/setUTC* arithmetic stays on the local date.
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

// Human label for a period `offset` back from now (0 = current): a week's date range,
// month name, or year — e.g. "June 1st – June 7th", "May" / "December 2025", "2026".
export function periodRangeLabel(period: Period, timeZone = 'UTC', offset = 0): string {
  const today = localToday(timeZone);
  if (period === 'year') return String(today.getUTCFullYear() - offset);
  if (period === 'month') {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    const month = MONTHS_FULL[d.getUTCMonth()];
    return d.getUTCFullYear() === today.getUTCFullYear() ? month : `${month} ${d.getUTCFullYear()}`;
  }
  const base = new Date(today);
  base.setUTCDate(today.getUTCDate() - offset * 7);
  const sinceMonday = (base.getUTCDay() + 6) % 7;
  const start = new Date(base);
  start.setUTCDate(base.getUTCDate() - sinceMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => `${MONTHS_FULL[d.getUTCMonth()]} ${ordinal(d.getUTCDate())}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

// Prev/next stepper pinned to the ends of its full-width row (the label lives
// separately via periodRangeLabel). Back increases offset; "next" disabled at offset 0.
export function PeriodNav({ offset, onChange }: { offset: number; onChange: (offset: number) => void }) {
  const arrow = 'p-1 rounded-md text-neutral-400 dark:text-neutral-500 enabled:hover:text-neutral-700 dark:enabled:hover:text-neutral-200 enabled:hover:bg-neutral-100 dark:enabled:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-default transition-colors';
  return (
    <div className="flex items-center justify-between">
      <button onClick={() => onChange(offset + 1)} aria-label="Previous period" className={arrow}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button onClick={() => onChange(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Next period" className={arrow}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
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
