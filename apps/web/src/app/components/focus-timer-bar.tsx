'use client';

import { useState } from 'react';
import { API_URL } from '../../lib/api';
import { useFocusTimer, elapsedMs, pauseTimer, resumeTimer, clearTimer } from '../../lib/focus-timer';
import { Heartbeat } from './heartbeat';

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// A live focus session, shown on the Overview while a timer is running/paused.
// Stopping it logs a time entry for the elapsed duration.
export function FocusTimerBar({ onLogged }: { onLogged: () => void }) {
  const timer = useFocusTimer();
  const [saving, setSaving] = useState(false);
  if (!timer) return null;

  const ms = elapsedMs(timer);
  const running = timer.startedAt !== null;

  async function stop() {
    const hours = elapsedMs(timer!) / 3_600_000;
    setSaving(true);
    // Log only sessions of at least ~1 second; shorter ones are just discarded.
    if (hours * 3_600_000 >= 1000) {
      await fetch(`${API_URL}/v1/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          occurred_at: new Date().toISOString(), // the session's end time
          hours,
          category: timer!.category,
          note: timer!.note || undefined,
          timed: true,
          task_id: timer!.taskId,
        }),
      }).catch(() => {});
      window.dispatchEvent(
        new CustomEvent('baseline:session-logged', { detail: { hours, taskId: timer!.taskId ?? null, taskTitle: timer!.note ?? null } }),
      );
    }
    clearTimer();
    setSaving(false);
    onLogged();
  }

  const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

  return (
    <div className="mb-6 flex items-center gap-4 p-4 rounded-xl border border-emerald-300/70 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/[0.06]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {timer.category}
            {!running && <span className="ml-2 text-xs font-normal text-neutral-400 dark:text-neutral-500">Paused</span>}
          </p>
          <Heartbeat running={running} />
        </div>
        {timer.note && <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{timer.note}</p>}
      </div>

      <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">{fmt(ms)}</span>

      <div className="flex items-center gap-2 flex-shrink-0">
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
