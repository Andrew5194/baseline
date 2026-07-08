'use client';

import { useState } from 'react';
import { useTimezone } from '../../lib/use-timezone';

export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  completed: number; // tasks completed that day
  total: number; // tasks scheduled/relevant that day
}

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Shade by completion ratio — empty when nothing's done, solid when all done.
function cellClass(completed: number, total: number): string {
  if (completed === 0) return 'bg-neutral-100 dark:bg-neutral-800';
  if (completed >= total) return 'bg-emerald-500';
  const ratio = completed / total;
  if (ratio >= 0.66) return 'bg-emerald-400/70 dark:bg-emerald-500/60';
  if (ratio >= 0.34) return 'bg-emerald-400/45 dark:bg-emerald-500/40';
  return 'bg-emerald-400/25 dark:bg-emerald-500/25';
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${MONTHS[m - 1]} ${d}`;
}

// Monthly view of task completion — one cell per day, shaded by completed/total.
// Click a day to populate that day's tasks below.
export function CompletionHeatmap({
  cells,
  onSelectDay,
  selected,
  countdown = false,
  onPrevMonth,
  onNextMonth,
  canNextMonth = true,
  focusStat = null,
}: {
  cells: HeatmapCell[];
  onSelectDay?: (date: string) => void;
  selected?: string | null;
  countdown?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  canNextMonth?: boolean;
  // The active (selected) day's stat, shown in the header regardless of which month is
  // on screen — so browsing to another month doesn't change the headline until you
  // pick a day there. A hovered cell temporarily overrides it.
  focusStat?: HeatmapCell | null;
}) {
  const tz = useTimezone();
  const [hover, setHover] = useState<number | null>(null);
  if (!cells.length) return null;

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  // The outline marks the selected day if one is chosen, otherwise today.
  const markedDate = selected ?? todayKey;
  // The day whose count we feature: the hovered cell, otherwise the selected day
  // (or today). Lets the user see "completed / scheduled" for the day at a glance.
  const focus = hover !== null ? cells[hover] : focusStat ?? cells.find((cell) => cell.date === markedDate) ?? null;
  const [yy, mm] = cells[0].date.split('-').map(Number);
  const monthName = `${MONTHS_FULL[mm - 1]} ${yy}`;
  // Month rollup — shown when no day is focused (e.g. a past month with no hover), so
  // the header keeps the same height as the per-day stat and doesn't jitter on hover.
  const monthDone = cells.reduce((a, c) => a + c.completed, 0);
  const monthTotal = cells.reduce((a, c) => a + c.total, 0);

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          {focus ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums leading-none">
                {countdown ? (
                  <>
                    {Math.max(0, focus.total - focus.completed)}
                    <span className="ml-2 align-middle text-sm font-semibold">
                      task{focus.total - focus.completed === 1 ? '' : 's'} to go
                    </span>
                  </>
                ) : (
                  <>
                    {focus.completed} / {focus.total}
                    <span className="ml-2 align-middle text-sm font-semibold">
                      task{focus.total === 1 ? '' : 's'} completed
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">
                {focus.date === todayKey ? 'Today · ' : ''}
                {dayLabel(focus.date)}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums leading-none">
                {countdown ? (
                  <>
                    {Math.max(0, monthTotal - monthDone)}
                    <span className="ml-2 align-middle text-sm font-semibold">
                      task{monthTotal - monthDone === 1 ? '' : 's'} to go
                    </span>
                  </>
                ) : (
                  <>
                    {monthDone} / {monthTotal}
                    <span className="ml-2 align-middle text-sm font-semibold">
                      task{monthTotal === 1 ? '' : 's'} completed
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">{monthName}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onPrevMonth && (
            <button
              onClick={onPrevMonth}
              aria-label="Previous month"
              className="p-0.5 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums text-center min-w-[84px]">{monthName}</p>
          {onNextMonth && (
            <button
              onClick={onNextMonth}
              disabled={!canNextMonth}
              aria-label="Next month"
              className="p-0.5 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cells.map((cell, i) => (
          <div
            key={cell.date}
            title={cell.date === todayKey ? 'Today' : undefined}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelectDay?.(cell.date)}
            className={`w-4 h-4 rounded-[4px] transition-colors ${onSelectDay ? 'cursor-pointer' : 'cursor-default'} ${cellClass(cell.completed, cell.total)} ${
              cell.date === markedDate ? 'outline outline-1 outline-offset-1 outline-neutral-900 dark:outline-white' : ''
            } ${hover === i ? 'ring-1 ring-neutral-400 dark:ring-neutral-400' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
