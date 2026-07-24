'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from './api';

// Live-sync channel so every mounted usePreference() consumer — and other tabs —
// refreshes when any preference changes, mirroring use-timezone.
const EVT = 'baseline:prefs-changed';
const BUMP_KEY = 'baseline:prefs-changed';

// A scalar UI preference persisted server-side (users.preferences, via /v1/me), so it
// follows the user across devices instead of living in this device's localStorage.
// Optimistic on toggle; re-synced live in this tab and across tabs. Returns
// [value, set, loaded] — `loaded` flips true once /v1/me has resolved at least once,
// so a consumer can defer rendering an animated view until the real value is known
// (avoids a fallback→stored flip that would replay a transition on mount). Defaults
// to a boolean preference; pass a string/number `fallback` for other scalar prefs.
export function usePreference<T extends boolean | string | number = boolean>(
  key: string,
  fallback: T = false as T,
): [T, (v: T) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  // Number of PATCHes still in flight. While > 0 the optimistic value is the source
  // of truth, so a /v1/me refetch must not overwrite it — otherwise a rapid burst of
  // toggles can have an earlier write's refetch read the server before a later write
  // commits, then revert the latest choice.
  const pending = useRef(0);

  useEffect(() => {
    const load = () =>
      apiFetch<{ preferences?: Record<string, unknown> | null }>('/v1/me')
        .then((m) => {
          // Don't clobber the optimistic value while a write is still settling.
          if (pending.current === 0) {
            const v = m?.preferences?.[key];
            // Only accept a stored value whose type matches the fallback's.
            setValue(typeof v === typeof fallback ? (v as T) : fallback);
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
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
      pending.current += 1;
      apiFetch('/v1/me', { method: 'PATCH', body: JSON.stringify({ preferences: { [key]: v } }) })
        .then(() => {
          pending.current -= 1;
          // Only re-broadcast once the LAST in-flight write has settled — so the
          // refetch it triggers reads a fully-committed, consistent server state
          // and can't revert a rapid sequence of toggles.
          if (pending.current === 0) {
            try {
              window.localStorage.setItem(BUMP_KEY, String(Date.now()));
            } catch {}
            window.dispatchEvent(new Event(EVT));
          }
        })
        .catch(() => {
          pending.current -= 1;
        });
    },
    [key],
  );

  return [value, set, loaded];
}
