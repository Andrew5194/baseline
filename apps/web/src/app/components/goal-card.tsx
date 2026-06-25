'use client';

import type { ReactNode } from 'react';
import { apiFetch } from '../../lib/api';

// Styled hover tooltip (the native `title` attribute is slow and OS-styled). Renders
// above the trigger so it stacks over earlier cards in the list rather than being
// covered by the next one.
function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex group/tt">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 w-56 px-2.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-700 text-white text-[11px] leading-snug text-center shadow-lg opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150"
      >
        {label}
      </span>
    </span>
  );
}

export type Cadence = 'day' | 'week' | 'month' | 'year';

export interface Goal {
  id: string;
  type: 'time' | 'github';
  metric: string;
  category: string | null;
  target: number;
  cadence: Cadence;
  title: string;
  unit: string;
  period_label: string;
  current: number;
  met: boolean;
  pct: number;
  streak: number;
}

export const CADENCE_ADVERB: Record<Cadence, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
};

const fmtUnit = (v: number, unit: string) => (unit === 'h' ? `${v}h` : `${v} ${unit}`);

const METRIC_WORD: Record<string, string> = {
  commits: 'commits',
  prs_merged: 'merged PRs',
  reviews: 'reviews',
  active_days: 'active days',
};

// Where a goal's progress comes from — manual logging vs. integration-detected events.
function verification(goal: Goal): { source: string; tip: string } {
  if (goal.type === 'time') {
    return {
      source: 'time entries',
      tip: `Verified from the time you log manually in the “${goal.category}” category.`,
    };
  }
  return {
    source: 'GitHub',
    tip: `Verified automatically from ${METRIC_WORD[goal.metric] ?? goal.metric} detected via your GitHub integration — no manual logging needed.`,
  };
}

interface GoalCardProps {
  goal: Goal;
  onChange: () => void;
}

export function GoalCard({ goal, onChange }: GoalCardProps) {
  async function remove() {
    await apiFetch(`/v1/goals/${goal.id}`, { method: 'DELETE' }).catch(console.error);
    onChange();
  }

  const barColor = goal.met ? 'bg-emerald-500' : 'bg-emerald-400/70';
  const verify = verification(goal);

  return (
    <div className="group p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {goal.type === 'time' ? goal.category : goal.title.split(' · ')[0]}
            </p>
            {goal.met && (
              <Tooltip label={verify.tip}>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0 cursor-help">
                  ✓ verified
                </span>
              </Tooltip>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            At least {fmtUnit(goal.target, goal.unit)} ·{' '}
            <Tooltip label={verify.tip}>
              <span className="cursor-help underline decoration-dotted decoration-neutral-300 dark:decoration-neutral-600 underline-offset-2">
                via {verify.source}
              </span>
            </Tooltip>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {goal.streak > 0 && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400" title={`${goal.streak} ${goal.cadence}s in a row`}>
              🔥 {goal.streak}
            </span>
          )}
          <button
            onClick={remove}
            aria-label="Delete goal"
            className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${goal.pct}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between mt-2">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">{fmtUnit(goal.current, goal.unit)}</span>
          {' '}/ {fmtUnit(goal.target, goal.unit)} {goal.period_label}
        </p>
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tabular-nums">{goal.pct}%</p>
      </div>
    </div>
  );
}
