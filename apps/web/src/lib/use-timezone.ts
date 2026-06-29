'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from './api';

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// The current user's configured timezone (from /v1/me). Starts at a fixed 'UTC' so
// the server render and the first client render agree (no hydration mismatch), then
// after mount resolves to the saved preference, falling back to the browser's tz.
export function useTimezone(): string {
  const [tz, setTz] = useState<string>('UTC');
  useEffect(() => {
    setTz(browserTimezone());
    apiFetch<{ timezone: string }>('/v1/me')
      .then((m) => {
        if (m?.timezone) setTz(m.timezone);
      })
      .catch(() => {});
  }, []);
  return tz;
}
