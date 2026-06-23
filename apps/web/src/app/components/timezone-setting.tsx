'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { browserTimezone } from '../../lib/use-timezone';

// All IANA zones when the runtime supports it; otherwise a sensible fallback list.
function allTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone');
    } catch {
      /* fall through */
    }
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];
}

export function TimezoneSetting() {
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = useMemo(() => allTimeZones(), []);

  useEffect(() => {
    apiFetch<{ timezone: string }>('/v1/me')
      .then((m) => setCurrent(m?.timezone || 'UTC'))
      .catch(() => setCurrent('UTC'));
  }, []);

  async function onChange(tz: string) {
    setCurrent(tz);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch('/v1/me', { method: 'PATCH', body: JSON.stringify({ timezone: tz }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const detected = browserTimezone();

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-medium">Timezone</p>
        {saving && <span className="text-[10px] text-neutral-400">Saving…</span>}
        {saved && <span className="text-[10px] text-emerald-500">Saved</span>}
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Your dashboard groups activity into calendar days, weeks, and months using this timezone.
      </p>
      <select
        value={current ?? ''}
        disabled={current === null}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-sm text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
      >
        {current === null ? (
          <option>Loading…</option>
        ) : (
          zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
            </option>
          ))
        )}
      </select>
      <p className="text-[11px] text-neutral-400 mt-2">
        Detected from your browser: <span className="font-medium">{detected.replace(/_/g, ' ')}</span>
      </p>
    </div>
  );
}
