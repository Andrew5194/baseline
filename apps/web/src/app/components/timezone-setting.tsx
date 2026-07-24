'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { browserTimezone, notifyTimezoneChanged } from '../../lib/use-timezone';

// One representative zone per region instead of the full ~400-entry IANA database
// (mostly near-duplicates). Ordered west→east; the UI re-sorts by current UTC offset.
// The user's own saved/detected zone is appended if missing (see `zones`), so no one
// is stuck without theirs.
const CURATED_ZONES: string[] = [
  'Pacific/Pago_Pago', 'Pacific/Honolulu', 'America/Anchorage',
  'America/Los_Angeles', 'America/Tijuana', 'America/Denver', 'America/Phoenix',
  'America/Chicago', 'America/Mexico_City', 'America/Guatemala',
  'America/New_York', 'America/Toronto', 'America/Bogota', 'America/Lima',
  'America/Caracas', 'America/Halifax', 'America/Santiago', 'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires', 'America/St_Johns',
  'Atlantic/South_Georgia', 'Atlantic/Azores', 'Atlantic/Cape_Verde',
  'UTC', 'Europe/London', 'Europe/Lisbon', 'Africa/Casablanca',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Africa/Lagos',
  'Europe/Athens', 'Europe/Helsinki', 'Europe/Bucharest', 'Africa/Cairo',
  'Asia/Jerusalem', 'Africa/Johannesburg',
  'Europe/Moscow', 'Europe/Istanbul', 'Asia/Riyadh', 'Africa/Nairobi',
  'Asia/Tehran', 'Asia/Dubai', 'Asia/Baku', 'Asia/Kabul',
  'Asia/Karachi', 'Asia/Tashkent', 'Asia/Kolkata', 'Asia/Colombo',
  'Asia/Kathmandu', 'Asia/Almaty', 'Asia/Dhaka', 'Asia/Yangon',
  'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Ho_Chi_Minh',
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Taipei',
  'Asia/Manila', 'Australia/Perth',
  'Asia/Tokyo', 'Asia/Seoul', 'Australia/Adelaide', 'Australia/Darwin',
  'Australia/Sydney', 'Australia/Brisbane', 'Pacific/Guam',
  'Pacific/Noumea', 'Pacific/Auckland', 'Pacific/Fiji',
  'Pacific/Chatham', 'Pacific/Tongatapu',
];

// A zone the runtime can actually use. Validate by constructing a formatter (accepts
// aliases like 'Asia/Kolkata') rather than `supportedValuesOf`, which lists only
// canonical ids and varies by ICU version — wrongly dropping valid aliased zones.
function isUsableZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Curated zones the current runtime actually knows about (drops any the tz data lacks).
function curatedZones(): string[] {
  return CURATED_ZONES.filter(isUsableZone);
}

// A zone's current offset from UTC, in minutes (accounts for DST at "now").
function offsetMinutes(tz: string, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const p: Record<string, string> = {};
    for (const { type, value } of parts) p[type] = value;
    // 24:00 shows up as hour '24' in some engines — normalize to 0.
    const hour = p.hour === '24' ? '00' : p.hour;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
    return Math.round((asUTC - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

// Format a minute offset as "GMT+04:00" / "GMT-05:30" (the common picker convention).
function formatOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `GMT${sign}${h}:${m}`;
}

// The city/last segment of an IANA id: 'America/Argentina/Buenos_Aires' → 'Buenos Aires'.
function cityName(tz: string): string {
  return (tz.split('/').pop() || tz).replace(/_/g, ' ');
}

// A human, DST-neutral zone name from Intl ('Eastern Time'). Returns null for zones
// that resolve only to a bare GMT offset (e.g. Etc/*), to avoid a redundant
// "(UTC+04:00) GMT+4".
function friendlyName(tz: string): string | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!name || /^(GMT|UTC)/i.test(name)) return null;
    return name;
  } catch {
    return null;
  }
}

// Conventional picker format: offset + friendly name + city. `min` is passed in so
// callers can reuse an already-computed offset.
function zoneLabelFrom(tz: string, min: number): string {
  const name = friendlyName(tz);
  return name
    ? `(${formatOffset(min)}) ${name} - ${cityName(tz)}`
    : `(${formatOffset(min)}) ${cityName(tz)}`;
}

function zoneLabel(tz: string): string {
  return zoneLabelFrom(tz, offsetMinutes(tz));
}

export function TimezoneSetting() {
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolved only after mount — browserTimezone() during render would differ between
  // server (UTC) and client, causing a hydration mismatch.
  const [detectedTz, setDetectedTz] = useState<string | null>(null);

  // Curated zones plus the user's own (if missing), sorted by current offset then
  // name — the usual tz-picker ordering.
  const zones = useMemo(() => {
    const ids = curatedZones();
    if (current && !ids.includes(current)) ids.push(current);
    return ids
      .map((id) => {
        const offset = offsetMinutes(id);
        return { id, offset, label: zoneLabelFrom(id, offset) };
      })
      .sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
  }, [current]);

  useEffect(() => {
    const detected = browserTimezone();
    setDetectedTz(detected);
    apiFetch<{ timezone: string; timezoneSet: boolean }>('/v1/me')
      .then((m) => {
        // An explicit selection always wins.
        if (m?.timezoneSet && m.timezone) {
          setCurrent(m.timezone);
          return;
        }
        // Not yet chosen — default to the browser's zone and persist it (not marked
        // explicit) so the server buckets activity in the zone the user sees, while
        // still tracking the browser until a manual choice.
        setCurrent(detected);
        if (detected !== m?.timezone) {
          apiFetch('/v1/me', {
            method: 'PATCH',
            body: JSON.stringify({ timezone: detected }),
          }).catch(() => {
            /* best-effort; the user can still change it manually */
          });
        }
      })
      .catch(() => setCurrent(detected));
  }, []);

  async function onChange(tz: string) {
    setCurrent(tz);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch('/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({ timezone: tz, explicit: true }),
      });
      // Tell mounted useTimezone() consumers to re-fetch so date math/labels update
      // live, not only on remount.
      notifyTimezoneChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

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
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))
        )}
      </select>
      {detectedTz && (
        <p className="text-[11px] text-neutral-400 mt-2">
          Detected from your browser: <span className="font-medium">{zoneLabel(detectedTz)}</span>
        </p>
      )}
    </div>
  );
}
