'use client';

const windows = ['7d', '30d', '90d'] as const;
type Window = (typeof windows)[number];

interface WindowSelectorProps {
  value: Window;
  onChange: (value: Window) => void;
}

export function WindowSelector({ value, onChange }: WindowSelectorProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
      {windows.map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === w
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
