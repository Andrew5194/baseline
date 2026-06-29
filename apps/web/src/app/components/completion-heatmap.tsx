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
}: {
  cells: HeatmapCell[];
  onSelectDay?: (date: string) => void;
  selected?: string | null;
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
  const focus = hover !== null ? cells[hover] : cells.find((cell) => cell.date === markedDate) ?? null;
  const [yy, mm] = cells[0].date.split('-').map(Number);
  const monthName = `${MONTHS_FULL[mm - 1]} ${yy}`;

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
      <div className="flex items-end justify-between mb-4">
        <div className="min-w-0">
          {focus ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-neutral-600 dark:text-neutral-300 tabular-nums leading-none">
                {focus.completed} / {focus.total}
                <span className="ml-2 align-middle text-sm font-semibold">
                  task{focus.total === 1 ? '' : 's'} completed
                </span>
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">
                {focus.date === todayKey ? 'Today · ' : ''}
                {dayLabel(focus.date)}
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{monthName}</p>
          )}
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums flex-shrink-0">{monthName}</p>
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
