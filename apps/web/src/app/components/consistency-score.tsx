'use client';

import { formatDelta, explainDelta } from '../../lib/format-delta';
import { Tooltip } from './tooltip';

interface ConsistencyScoreProps {
  activeDays: number | null;
  priorActiveDays?: number | null; // active days by the same point in the prior period
  totalDays: number;
  delta: number | null;
  window: string;
}

const toneColor: Record<'up' | 'down' | 'neutral', string> = {
  up: 'text-emerald-600',
  down: 'text-red-500',
  neutral: 'text-neutral-400',
};

export function ConsistencyScore({ activeDays, priorActiveDays, totalDays, delta, window }: ConsistencyScoreProps) {
  const score = activeDays !== null && totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : null;

  const radius = 54;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;

  const f = formatDelta(delta, activeDays);
  const deltaColor = toneColor[f.tone];
  const deltaText = `${f.text} vs prior ${window}`;

  // Spell out exactly what's being compared: this period's elapsed slice against the
  // prior period's matching slice — with both day counts and the explicit division.
  const canBreakdown = activeDays !== null && priorActiveDays !== null && priorActiveDays !== undefined && priorActiveDays !== 0;
  const pct = canBreakdown ? Math.round(((activeDays! - priorActiveDays!) / priorActiveDays!) * 100) : 0;
  const deltaTip = canBreakdown
    ? `${activeDays} of ${totalDays} active days so far this ${window} vs ${priorActiveDays} of ${totalDays} by the same point last ${window}  →  (${activeDays} − ${priorActiveDays}) ÷ ${priorActiveDays} = ${pct > 0 ? '+' : ''}${pct}%`
    : explainDelta(activeDays, priorActiveDays ?? null, window, 'active days');

  const scoreColor = score === null ? '#a3a3a3' : score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-6">
      {/* Ring */}
      <div className="flex-shrink-0 relative">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" className="text-neutral-100 dark:text-neutral-800" strokeWidth={stroke} />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            transform="rotate(-90 64 64)"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{score !== null ? `${score}` : '—'}</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-0.5">%</span>
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">Consistency Score</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {activeDays !== null ? activeDays : '—'} active days out of {totalDays} so far this {window}
        </p>
        <Tooltip content={deltaTip}>
          <p className={`w-fit text-xs mt-2 ${deltaColor}`}>{deltaText}</p>
        </Tooltip>
      </div>
    </div>
  );
}
