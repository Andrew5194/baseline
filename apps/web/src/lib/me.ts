'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from './api';

// The current user's profile from /v1/me — timezone + synced UI preferences. Shared
// in one module-level store so every consumer (all usePreference() + useTimezone()
// hooks) reads from a SINGLE, request-coalesced fetch instead of each firing its own
// /v1/me. The cache persists across client-side navigations, so moving between pages
// doesn't refetch.
export interface Me {
  id?: string;
  email?: string;
  name?: string | null;
  timezone?: string;
  timezoneSet?: boolean;
  preferences?: Record<string, unknown> | null;
}

// Cross-tab breadcrumb: writing it fires a `storage` event in OTHER tabs, which
// refetch so a change made in one tab shows up everywhere.
const BUMP_KEY = 'baseline:me-changed';

// Stable references for the "not loaded yet" state, so useSyncExternalStore's server
// snapshot and the initial client snapshot are identity-equal (no hydration churn).
const EMPTY: { me: Me | null; loaded: boolean } = { me: null, loaded: false };

let cache: Me | null = null;
let loaded = false;
let inflight: Promise<Me> | null = null;
let pending = 0; // in-flight PATCHes; while > 0 a refetch must not clobber optimistic state
let snapshot = EMPTY;
const subscribers = new Set<() => void>();
let crossTabBound = false;

function emit(): void {
  snapshot = { me: cache, loaded };
  for (const fn of subscribers) fn();
}

function bindCrossTab(): void {
  if (crossTabBound || typeof window === 'undefined') return;
  crossTabBound = true;
  window.addEventListener('storage', (e) => {
    if (e.key === BUMP_KEY) refreshMe();
  });
}

// Coalesced fetch: concurrent callers share one in-flight request; a cached value is
// reused unless `force` is set (used to reconcile after a change).
export function fetchMe(force = false): Promise<Me> {
  if (inflight) return inflight;
  if (!force && cache) return Promise.resolve(cache);
  // The store is /v1/me's single cache/coalescer, so skip the generic apiFetch cache.
  const p = apiFetch<Me>('/v1/me', { noCache: true })
    .then((m) => {
      cache = m ?? {};
      loaded = true;
      emit();
      return cache;
    })
    .catch(() => {
      loaded = true;
      emit();
      return (cache ?? {}) as Me;
    })
    .finally(() => {
      if (inflight === p) inflight = null;
    });
  inflight = p;
  return p;
}

// Refetch to reconcile — but never while a local write is settling, so the optimistic
// value (which is authoritative until the PATCH lands) can't be reverted by a stale read.
export function refreshMe(): void {
  if (pending > 0) return;
  fetchMe(true);
}

// Apply a change locally and notify every consumer. `preferences` merge shallowly so a
// one-key update keeps the rest. The server stores exactly what we send, so this
// optimistic value equals the eventual server value — no same-tab refetch needed.
export function updateMe(patch: Me): void {
  cache = {
    ...(cache ?? {}),
    ...patch,
    preferences:
      patch.preferences !== undefined
        ? { ...(cache?.preferences ?? {}), ...(patch.preferences ?? {}) }
        : cache?.preferences,
  };
  emit();
}

// Track an in-flight PATCH so cross-tab consumers are told once the last one settles.
export function trackWrite(req: Promise<unknown>): void {
  pending++;
  req.finally(() => {
    pending--;
    if (pending === 0) {
      try {
        window.localStorage.setItem(BUMP_KEY, String(Date.now()));
      } catch {
        /* private mode, etc. */
      }
    }
  });
}

// Nudge other tabs to resync (e.g. after a write that didn't go through trackWrite).
export function broadcastMe(): void {
  try {
    window.localStorage.setItem(BUMP_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Subscribe a React component to the shared profile, ensuring it's fetched once.
export function useMe(): { me: Me | null; loaded: boolean } {
  const s = useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    () => snapshot,
    () => EMPTY,
  );
  useEffect(() => {
    bindCrossTab();
    fetchMe();
  }, []);
  return s;
}
