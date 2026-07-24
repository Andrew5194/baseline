'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';

interface LoggedDetail {
  hours: number;
  taskId?: string | null;
  taskTitle?: string | null;
}

const COUNTDOWN = 10; // seconds the "mark complete" prompt stays before auto-closing

// A natural session length ("1h 23m" / "23m"), independent of the unit toggle.
function fmtSession(hours: number): string {
  const totalMin = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Global toast shown after a timer's "Stop & log". Confirms the time was logged; if
// the session was tied to a task, also offers to mark it complete. Task-less sessions
// just confirm and fade.
export function SessionToast() {
  const [toast, setToast] = useState<LoggedDetail | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN);

  useEffect(() => {
    const onLogged = (e: Event) => {
      const detail = (e as CustomEvent<LoggedDetail>).detail;
      setCompleting(false);
      setCompleted(false);
      setSecondsLeft(COUNTDOWN); // start full so the ring counts down, not up
      setToast(detail);
    };
    window.addEventListener('baseline:session-logged', onLogged);
    return () => window.removeEventListener('baseline:session-logged', onLogged);
  }, []);

  // A task prompt counts down then auto-closes; a plain or just-completed confirmation
  // just fades quickly.
  useEffect(() => {
    if (!toast) return;
    const lingers = !!toast.taskId && !completed;
    if (!lingers) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
    let remaining = COUNTDOWN;
    setSecondsLeft(remaining);
    const iv = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(iv);
        setToast(null);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [toast, completed]);

  if (!toast) return null;

  async function markComplete() {
    if (!toast?.taskId) return;
    setCompleting(true);
    try {
      await apiFetch(`/v1/tasks/${toast.taskId}/complete`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('baseline:todos-changed'));
      window.dispatchEvent(new CustomEvent('baseline:goals-changed'));
      setCompleted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  }

  const askComplete = !!toast.taskId && !completed;

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-72 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{completed ? 'Task completed' : 'Time logged'}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {fmtSession(toast.hours)}
            {toast.taskTitle ? ` · ${toast.taskTitle}` : ''}
          </p>
        </div>
        <button
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex-shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {askComplete && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setToast(null)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Keep open
          </button>
          <button
            onClick={markComplete}
            disabled={completing}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {completing ? 'Completing…' : 'Mark complete'}
          </button>
          {/* live countdown until the prompt auto-closes */}
          <div className="relative flex h-7 w-7 items-center justify-center" title="Auto-closing">
            <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" strokeWidth="2.5" className="stroke-neutral-200 dark:stroke-neutral-700" />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="stroke-emerald-500"
                strokeDasharray={2 * Math.PI * 11}
                strokeDashoffset={2 * Math.PI * 11 * (1 - secondsLeft / COUNTDOWN)}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="absolute text-[10px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">{secondsLeft}</span>
          </div>
        </div>
      )}
    </div>
  );
}
