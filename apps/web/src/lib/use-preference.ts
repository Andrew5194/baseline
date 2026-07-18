'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api';

// Live-sync channel so every mounted usePreference() consumer — and other tabs —
// refreshes when any preference changes, mirroring use-timezone.
const EVT = 'baseline:prefs-changed';
const BUMP_KEY = 'baseline:prefs-changed';

// A scalar UI preference persisted server-side (users.preferences, via /v1/me), so
// it follows the user across devices instead of living in this device's localStorage.
// Optimistic on toggle; re-synced live in this tab and across tabs. Starts at
// `fallback` until /v1/me resolves, so server and first client render agree. Defaults
// to a boolean preference; pass a string/number `fallback` for other scalar prefs.
export function usePreference<T extends boolean | string | number = boolean>(
  key: string,
  fallback: T = false as T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const load = () =>
      apiFetch<{ preferences?: Record<string, unknown> | null }>('/v1/me')
        .then((m) => {
          const v = m?.preferences?.[key];
          // Only accept a stored value whose type matches the fallback's.
          setValue(typeof v === typeof fallback ? (v as T) : fallback);
        })
        .catch(() => {});
    load();
    window.addEventListener(EVT, load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener('storage', load);
    };
  }, [key, fallback]);

  const set = useCallback(
    (v: T) => {
      setValue(v); // optimistic
      apiFetch('/v1/me', { method: 'PATCH', body: JSON.stringify({ preferences: { [key]: v } }) })
        .then(() => {
          // Nudge this tab's other consumers + other tabs to re-sync from the server.
          try {
            window.localStorage.setItem(BUMP_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event(EVT));
        })
        .catch(() => {});
    },
    [key],
  );

  return [value, set];
}
