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

// The current user's configured timezone (from /v1/me). Starts at the browser's
// timezone for a sensible first paint, then resolves to the saved preference.
export function useTimezone(): string {
  const [tz, setTz] = useState<string>(browserTimezone);
  useEffect(() => {
    apiFetch<{ timezone: string }>('/v1/me')
      .then((m) => {
        if (m?.timezone) setTz(m.timezone);
      })
      .catch(() => {});
  }, []);
  return tz;
}
