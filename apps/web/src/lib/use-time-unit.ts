'use client';

import { useState, useEffect } from 'react';
import { type TimeUnit, isTimeUnit } from './time-units';

// The user's chosen display unit for durations, shared across every page. Persisted
// to localStorage and synced live within the tab (custom event) and across tabs
// (storage event), so changing it on the Overview updates History, Metrics, etc.
const KEY = 'baseline:time-unit';
const EVT = 'baseline:time-unit-changed';

export function readTimeUnit(): TimeUnit {
  if (typeof window === 'undefined') return 'hr';
  const v = window.localStorage.getItem(KEY);
  return v && isTimeUnit(v) ? v : 'hr';
}

export function setStoredTimeUnit(unit: TimeUnit): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, unit);
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

// Returns [unit, setUnit]. Starts at 'hr' on the server/first render (so there's no
// hydration mismatch), then resolves to the stored value after mount.
export function useTimeUnit(): [TimeUnit, (u: TimeUnit) => void] {
  const [unit, setUnit] = useState<TimeUnit>('hr');

  useEffect(() => {
    const sync = () => setUnit(readTimeUnit());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const set = (u: TimeUnit) => {
    setStoredTimeUnit(u); // notifies every other mounted hook
    setUnit(u);
  };

  return [unit, set];
}
