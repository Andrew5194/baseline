'use client';

import { useCallback } from 'react';
import { apiFetch } from './api';
import { useMe, updateMe, trackWrite } from './me';

// A scalar UI preference persisted server-side (users.preferences, via /v1/me), so it
// follows the user across devices instead of living in this device's localStorage.
// Reads from the shared `useMe` store — so every preference shares ONE /v1/me fetch —
// and writes optimistically: the store updates every consumer instantly, then the
// PATCH persists it. Because the optimistic value is authoritative (the server just
// stores what we send), there's no same-tab refetch to race with, so rapid toggles
// can't revert. Returns [value, set, loaded]; `loaded` is true once /v1/me resolves,
// letting a consumer defer an animated view until the real value is known. Defaults to
// a boolean preference; pass a string/number `fallback` for other scalar prefs.
export function usePreference<T extends boolean | string | number = boolean>(
  key: string,
  fallback: T = false as T,
): [T, (v: T) => void, boolean] {
  const { me, loaded } = useMe();
  const raw = me?.preferences?.[key];
  // Only accept a stored value whose type matches the fallback's.
  const value = typeof raw === typeof fallback ? (raw as T) : fallback;

  const set = useCallback(
    (v: T) => {
      updateMe({ preferences: { [key]: v } }); // optimistic, shared across all consumers
      trackWrite(
        apiFetch('/v1/me', {
          method: 'PATCH',
          body: JSON.stringify({ preferences: { [key]: v } }),
        }).catch(() => {}),
      );
    },
    [key],
  );

  return [value, set, loaded];
}
