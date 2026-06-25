'use client';

import type { Cadence } from './goal-card';

const OPTIONS: Array<{ value: Cadence; label: string }> = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

interface CadenceSelectorProps {
  value: Cadence;
  onChange: (value: Cadence) => void;
}

// Segmented control mirroring the period selector used on Overview/Metrics.
export function CadenceSelector({ value, onChange }: CadenceSelectorProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === o.value
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
