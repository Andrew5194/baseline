'use client';

import { useEffect, useState } from 'react';
import { useMe, refreshMe, broadcastMe } from './me';

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Call after persisting a new timezone to /v1/me so all consumers refresh live: resync
// the shared profile here, and breadcrumb other tabs to do the same.
export function notifyTimezoneChanged(): void {
  refreshMe();
  broadcastMe();
}

// The user's configured timezone, from the shared /v1/me store (no separate fetch).
// Starts at a fixed 'UTC' on server and first client render (no hydration mismatch),
// then after mount resolves to the saved preference, falling back to the browser's zone
// until the user has explicitly chosen one (`timezoneSet`).
export function useTimezone(): string {
  const { me } = useMe();
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  useEffect(() => {
    setBrowserTz(browserTimezone());
  }, []);
  if (me?.timezoneSet && me.timezone) return me.timezone;
  return browserTz ?? 'UTC';
}
