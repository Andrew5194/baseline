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
