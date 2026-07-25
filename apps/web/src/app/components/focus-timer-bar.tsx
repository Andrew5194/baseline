'use client';

import { useState } from 'react';
import { API_URL } from '../../lib/api';
import { useFocusTimer, elapsedMs, formatElapsed, pauseTimer, resumeTimer, clearTimer } from '../../lib/focus-timer';
import { Heartbeat } from './heartbeat';

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

  // Fluid so the controls shrink gradually, then wrap onto a second row (below the
  // category + timer) when the screen is too narrow to keep them on one line.
  const btn = 'py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap text-[clamp(11px,2.4vw,12px)] px-[clamp(0.5rem,1.8vw,0.75rem)]';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 p-4 rounded-xl border border-emerald-300/70 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/[0.06]">
      {/* Category/note + timer keep row 1 (min-w stops them squishing so the controls
          stay wrapped); the controls drop to their own row on phones. */}
      <div className="flex flex-1 min-w-[10rem] items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
              {timer.category}
              {!running && <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500">Paused</span>}
            </p>
            <Heartbeat running={running} />
          </div>
          {timer.note && <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{timer.note}</p>}
        </div>
        <span className="flex-shrink-0 text-2xl font-semibold tabular-nums text-stone-900 dark:text-white">{formatElapsed(ms)}</span>
      </div>

      {/* Own full-width row on phones, but kept right-aligned; inline right from sm up. */}
      <div className="basis-full sm:basis-auto sm:ml-auto flex items-center justify-end gap-2 flex-shrink-0">
        {running ? (
          <button onClick={pauseTimer} className={`${btn} border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800`}>
            Pause
          </button>
        ) : (
          <button onClick={resumeTimer} className={`${btn} border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800`}>
            Resume
          </button>
        )}
        <button onClick={stop} disabled={saving} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50`}>
          {saving ? 'Saving…' : 'Stop & log'}
        </button>
        <button onClick={() => clearTimer()} aria-label="Discard session" className="text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none px-1">
          ×
        </button>
      </div>
    </div>
  );
}
