'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from './api';

// Live-sync channel for the user's timezone, mirroring use-time-unit: changing the
// saved zone dispatches EVT so every mounted useTimezone() consumer re-fetches and
// re-renders immediately, instead of only picking up the change on a remount. The
// localStorage breadcrumb makes OTHER tabs re-fetch too (via the `storage` event).
const EVT = 'baseline:timezone-changed';
const BUMP_KEY = 'baseline:tz-changed';

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Call after persisting a new timezone to /v1/me so all consumers refresh live.
export function notifyTimezoneChanged(): void {
  if (typeof window === 'undefined') return;
  try {
    // Writing localStorage fires a `storage` event in other tabs (not this one).
    window.localStorage.setItem(BUMP_KEY, String(Date.now()));
  } catch {}
  window.dispatchEvent(new Event(EVT)); // this tab
}

// The current user's configured timezone (from /v1/me). Starts at a fixed 'UTC' so
// the server render and the first client render agree (no hydration mismatch), then
// after mount resolves to the saved preference, falling back to the browser's tz.
//
// Until the user has explicitly chosen a zone (`timezone_set` is false), we use the
// browser's detected timezone rather than the stored 'UTC' default.
export function useTimezone(): string {
  const [tz, setTz] = useState<string>('UTC');
  useEffect(() => {
    setTz(browserTimezone()); // fallback until /v1/me resolves
    const load = () =>
      apiFetch<{ timezone: string; timezoneSet: boolean }>('/v1/me')
        .then((m) => {
          if (m?.timezoneSet && m.timezone) setTz(m.timezone);
        })
        .catch(() => {});
    load();
    // Re-fetch when the timezone changes here (custom event) or in another tab
    // (storage event), so no consumer is left showing dates in the old zone.
    window.addEventListener(EVT, load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return tz;
}
