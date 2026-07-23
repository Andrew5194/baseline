'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api';

// Live-sync channel so every mounted usePreference() consumer — and other tabs —
// refreshes when any preference changes, mirroring use-timezone.
const EVT = 'baseline:prefs-changed';
const BUMP_KEY = 'baseline:prefs-changed';

// Last-known preferences from /v1/me, cached in-module so a remount (e.g. navigating
// between pages) can seed the correct value synchronously instead of flashing the
// fallback and animating to the stored value once the fetch resolves.
let prefsCache: Record<string, unknown> | null = null;

function readPref<T>(key: string, fallback: T): T {
  const v = prefsCache?.[key];
  // Only accept a stored value whose type matches the fallback's.
  return typeof v === typeof fallback ? (v as T) : fallback;
}

// A scalar UI preference persisted server-side (users.preferences, via /v1/me), so
// it follows the user across devices instead of living in this device's localStorage.
// Optimistic on toggle; re-synced live in this tab and across tabs. Seeds from the
// in-module cache so a remount doesn't flash `fallback` (only the very first load,
// before any /v1/me has resolved, starts at `fallback`). Defaults to a boolean
// preference; pass a string/number `fallback` for other scalar prefs.
export function usePreference<T extends boolean | string | number = boolean>(
  key: string,
  fallback: T = false as T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => readPref(key, fallback));

  useEffect(() => {
    const load = () =>
      apiFetch<{ preferences?: Record<string, unknown> | null }>('/v1/me')
        .then((m) => {
          prefsCache = m?.preferences ?? {};
          setValue(readPref(key, fallback));
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
      prefsCache = { ...(prefsCache ?? {}), [key]: v }; // keep the cache in step
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
