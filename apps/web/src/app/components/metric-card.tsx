'use client';

interface MetricCardProps {
  label: string;
  value: number | null;
  delta: number | null;
  unit: string;
  active?: boolean;
  onClick?: () => void;
}

export function MetricCard({ label, value, delta, unit, active, onClick }: MetricCardProps) {
  const formattedValue = value === null ? '—' : `${value}`;
  const deltaColor = delta === null ? '' : delta >= 0 ? 'text-emerald-600' : 'text-red-500';
  const deltaText =
    delta === null ? '' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(delta * 100))}%`;

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
      {deltaText && (
        <p className={`text-xs mt-1 ${deltaColor}`}>{deltaText}</p>
      )}
    </button>
  );
}
