'use client';

import { useState } from 'react';
import { API_URL } from '../../lib/api';
import { useFocusTimer, elapsedMs, startTimer, pauseTimer, resumeTimer, clearTimer } from '../../lib/focus-timer';
import { Heartbeat } from './heartbeat';

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// A per-task focus timer sharing the single global timer (so it also shows on the
// Overview), tagged with this task's id. Stopping logs a time entry.
export function TaskTimer({
  taskId,
  title,
  category,
  onLogged,
  hideStart = false,
}: {
  taskId: string;
  title: string;
  category: string;
  onLogged?: () => void;
  hideStart?: boolean; // suppress the idle Start button (timers are started from the kebab)
}) {
  const timer = useFocusTimer();
  const [saving, setSaving] = useState(false);
  const isThis = timer?.taskId === taskId;
  const otherRunning = !!timer && !isThis;

  async function stop() {
    if (!timer) return;
    const hours = elapsedMs(timer) / 3_600_000;
    setSaving(true);
    if (hours * 3_600_000 >= 1000) {
      await fetch(`${API_URL}/v1/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          occurred_at: new Date().toISOString(),
          hours,
          // The category chosen when the timer was started (stored on the timer).
          category: timer.category || category,
          note: title,
          timed: true,
          task_id: taskId,
        }),
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('baseline:session-logged', { detail: { hours, taskId, taskTitle: title } }));
    }
    clearTimer();
    setSaving(false);
    onLogged?.();
  }

  const btn = 'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors';

  if (!isThis) {
    if (hideStart) return null; // timers are started from the row's kebab menu
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => startTimer(category, title, taskId)}
          disabled={otherRunning}
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5`}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Start
        </button>
        {otherRunning && (
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Another timer is running</span>
        )}
      </div>
    );
  }

  const ms = elapsedMs(timer);
  const running = timer.startedAt !== null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-emerald-300/70 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/[0.06]">
      <Heartbeat running={running} />
      <span className="text-base font-semibold tabular-nums text-neutral-900 dark:text-white">{fmt(ms)}</span>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        {running ? (
          <button onClick={pauseTimer} className={`${btn} border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800`}>
            Pause
          </button>
        ) : (
          <button onClick={resumeTimer} className={`${btn} border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800`}>
            Resume
          </button>
        )}
        <button onClick={stop} disabled={saving} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50`}>
          {saving ? 'Saving…' : 'Stop & log'}
        </button>
        <button onClick={() => clearTimer()} aria-label="Discard session" className="text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none px-1">
          ×
        </button>
      </div>
    </div>
  );
}
