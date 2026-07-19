'use client';

import { useState, useEffect, useCallback } from 'react';
import { TaskTimer } from './task-timer';
import { type TimeUnit, fmtDuration } from '../../lib/time-units';
import {
  type TaskEntry,
  getCachedTaskEntries,
  fetchTaskEntries,
  invalidateTaskEntries,
} from '../../lib/task-entries';

const fmtTime = (d: Date, tz: string) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
const fmtDate = (d: Date, tz: string) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });

// A session's start → end. `occurred_at` is the end instant, so the start is end
// minus the duration. Collapses to one date when both fall on the same local day.
function sessionRange(iso: string, hours: number, tz: string): string {
  const end = new Date(iso);
  const start = new Date(end.getTime() - hours * 3_600_000);
  if (fmtDate(start, tz) === fmtDate(end, tz)) {
    return `${fmtDate(start, tz)}, ${fmtTime(start, tz)} – ${fmtTime(end, tz)}`;
  }
  return `${fmtDate(start, tz)} ${fmtTime(start, tz)} – ${fmtDate(end, tz)} ${fmtTime(end, tz)}`;
}

// The expanded panel under a task: the sessions already logged against it (newest
// first), with the Start button / running timer always at the bottom of the list.
export function TaskTimerPanel({
  taskId,
  title,
  category,
  color,
  tz,
  unit,
  onLogged,
  taskDone,
}: {
  taskId: string;
  title: string;
  category: string;
  color: string; // the task's label (goal/category) color, used for the entry bullets
  tz: string;
  unit: TimeUnit;
  onLogged?: () => void;
  taskDone?: boolean;
}) {
  // Seed from cache so a re-open (or a kebab-prefetched open) paints instantly;
  // null means "no cached value yet" → show a shimmer while the first fetch runs.
  const [entries, setEntries] = useState<TaskEntry[] | null>(() => getCachedTaskEntries(taskId) ?? null);

  const load = useCallback(() => {
    fetchTaskEntries(taskId).then(setEntries);
  }, [taskId]);

  useEffect(() => {
    const cached = getCachedTaskEntries(taskId);
    if (cached) setEntries(cached); // instant paint
    load(); // always revalidate in the background
  }, [taskId, load]);

  // After a session is logged, drop the stale cache entry and refetch.
  const logged = () => {
    invalidateTaskEntries(taskId);
    load();
    onLogged?.();
  };

  return (
    <div className="space-y-2">
      {entries === null ? (
        <div className="space-y-1">
          {[0, 1].map((i) => (
            <div key={i} className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded shimmer" />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
                title={e.timed ? 'Timed session' : 'Logged time'}
              />
              <span className="flex-1 min-w-0 truncate">
                {e.timed ? sessionRange(e.occurred_at, e.hours, tz) : fmtDate(new Date(e.occurred_at), tz)}
              </span>
              <span className="flex-shrink-0 tabular-nums font-medium text-neutral-700 dark:text-neutral-300">
                {fmtDuration(e.hours, unit)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!taskDone ? (
        <TaskTimer taskId={taskId} title={title} category={category} onLogged={logged} hideStart />
      ) : entries && entries.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">No sessions logged.</p>
      ) : null}
    </div>
  );
}
