'use client';

import { formatDelta } from '../../lib/format-delta';

interface MetricCardProps {
  label: string;
  value: number | null;
  delta: number | null;
  unit: string;
  window?: string;
  active?: boolean;
  onClick?: () => void;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  if (unit === 'hours') return value.toFixed(1);
  if (unit === 'days' || unit === 'ratio') return value.toFixed(1);
  if (unit === 'score') return `${Math.round(value)}`;
  return `${value}`;
}

export function MetricCard({ label, value, delta, unit, window, active, onClick }: MetricCardProps) {
  const formattedValue = formatValue(value, unit);
  const f = formatDelta(delta, value);
  const toneColor = { up: 'text-emerald-600', down: 'text-red-500', neutral: 'text-neutral-400' }[f.tone];

  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-xl border transition-colors ${
        active
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5'
          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
    >
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight">{formattedValue}</p>
        <p className="text-xs text-neutral-400">{unit}</p>
      </div>
      {(delta !== null || window) && (
        <p className={`text-xs mt-1 ${toneColor}`}>
          {f.text} vs prior {window || '30d'}
        </p>
      )}
    </button>
  );
}
