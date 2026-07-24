'use client';

import { formatDelta, explainDelta } from '../../lib/format-delta';
import { Tooltip } from './tooltip';

interface ConsistencyScoreProps {
  activeDays: number | null;
  totalDays: number;
  delta: number | null;
  window: string;
}

const toneColor: Record<'up' | 'down' | 'neutral', string> = {
  up: 'text-emerald-600',
  down: 'text-red-500',
  neutral: 'text-neutral-400',
};

export function ConsistencyScore({ activeDays, totalDays, delta, window }: ConsistencyScoreProps) {
  const score = activeDays !== null && totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : null;

  const radius = 54;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;

  const f = formatDelta(delta, activeDays);
  const deltaColor = toneColor[f.tone];
  const deltaText = `${f.text} vs prior ${window}`;

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
        <Tooltip content={explainDelta(activeDays, delta, window, 'active days')}>
          <p className={`text-xs mt-2 ${deltaColor}`}>{deltaText}</p>
        </Tooltip>
      </div>
    </div>
  );
}
