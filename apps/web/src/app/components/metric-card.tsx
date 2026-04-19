'use client';

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
  const deltaColor = delta === null ? '' : delta >= 0 ? 'text-emerald-600' : 'text-red-500';
  const deltaPct = delta === null ? '' : `${Math.abs(Math.round(delta * 100))}%`;
  const deltaArrow = delta === null ? '' : delta >= 0 ? '▲' : '▼';
  const windowLabel = window ? ` vs prior ${window}` : '';

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
      {delta !== null ? (
        <p className={`text-xs mt-1 ${deltaColor}`}>
          {deltaArrow} {deltaPct} vs prior {window || '30d'}
        </p>
      ) : window ? (
        <p className="text-xs mt-1 text-neutral-400">—  vs prior {window}</p>
      ) : null}
    </button>
  );
}
