'use client';

import { useState, useEffect } from 'react';

// A single running focus/Pomodoro session, persisted to localStorage so it survives
// navigation and reloads (and stays in sync across tabs).
export interface FocusTimerState {
  category: string;
  note: string;
  startedAt: number | null; // epoch ms of the current running segment; null when paused
  accumulatedMs: number; // ms accrued before the current running segment
  taskId?: string; // when started from a task in the to-do list
}

const KEY = 'baseline:focus-timer';
const EVT = 'baseline:focus-timer-changed';

export function readTimer(): FocusTimerState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FocusTimerState) : null;
  } catch {
    return null;
  }
}

function writeTimer(s: FocusTimerState | null) {
  if (typeof window === 'undefined') return;
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function elapsedMs(s: FocusTimerState | null): number {
  if (!s) return 0;
  return s.accumulatedMs + (s.startedAt ? Date.now() - s.startedAt : 0);
}

// A running elapsed duration as mm:ss (or h:mm:ss once past an hour).
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function startTimer(category: string, note: string, taskId?: string) {
  writeTimer({ category, note, startedAt: Date.now(), accumulatedMs: 0, taskId });
}

// Patch the running timer in place (e.g. when the task it tracks is re-categorized).
export function updateTimer(partial: Partial<FocusTimerState>) {
  const s = readTimer();
  if (s) writeTimer({ ...s, ...partial });
}

export function pauseTimer() {
  const s = readTimer();
  if (s?.startedAt) {
    writeTimer({ ...s, accumulatedMs: s.accumulatedMs + (Date.now() - s.startedAt), startedAt: null });
  }
}

export function resumeTimer() {
  const s = readTimer();
  if (s && s.startedAt === null) writeTimer({ ...s, startedAt: Date.now() });
}

export function clearTimer() {
  writeTimer(null);
}

// Subscribe to the timer: null on the server + first client render (no hydration
// mismatch), then hydrates after mount; re-renders once a second while running.
export function useFocusTimer(): FocusTimerState | null {
  const [state, setState] = useState<FocusTimerState | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setState(readTimer());
    sync();
    // Cross-tab: react only to our key (or a full clear → key null). Other tabs' writes
    // must not wake this hook. The in-tab EVT has no `key`, so it keeps `sync`.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) sync();
    };
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!state?.startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state?.startedAt]);

  return state;
}
