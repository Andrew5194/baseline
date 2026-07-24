'use client';

import { formatDelta, explainDelta } from '../../lib/format-delta';

export interface StripStat {
  key: string;
  label: string;
  value: string | number;
  sub?: string;
  // Fractional change vs the prior period (e.g. 0.12 = +12%). undefined → no delta row.
  delta?: number | null;
}

const toneColor: Record<'up' | 'down' | 'neutral', string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-500 dark:text-red-400',
  neutral: 'text-neutral-400 dark:text-neutral-600',
};

interface MetricsStripProps {
  stats: StripStat[];
  activeKey?: string;
  onSelect?: (key: string) => void;
  accent?: string;
}

// Compact horizontal KPI strip. When `onSelect` is provided, each cell is a button
// that selects the metric (highlighted with an accent underline).
export function MetricsStrip({ stats, activeKey, onSelect, accent = '#10b981' }: MetricsStripProps) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
      {stats.map((s) => {
        const active = activeKey === s.key;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag
            key={s.key}
            {...(onSelect ? { onClick: () => onSelect(s.key), type: 'button' as const } : {})}
            className={`relative px-4 py-3.5 text-left transition-colors ${
              onSelect ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40' : ''
            } ${active ? 'bg-neutral-50 dark:bg-neutral-800/40' : ''}`}
          >
            <p className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{s.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-white">
              {s.value}
              {s.sub && <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500"> {s.sub}</span>}
            </p>
            {s.delta !== undefined && (() => {
              const num = typeof s.value === 'number' ? s.value : parseFloat(String(s.value));
              const cur = Number.isFinite(num) ? num : null;
              const f = formatDelta(s.delta ?? null, cur);
              return (
                <p
                  className={`mt-0.5 text-[11px] tabular-nums ${toneColor[f.tone]} cursor-help`}
                  title={explainDelta(cur, s.delta ?? null, 'period', typeof s.sub === 'string' ? s.sub : undefined)}
                >
                  {f.text}
                </p>
              );
            })()}
            {active && <span className="absolute left-0 right-0 bottom-0 h-[2px]" style={{ backgroundColor: accent }} />}
          </Tag>
        );
      })}
    </div>
  );
}
