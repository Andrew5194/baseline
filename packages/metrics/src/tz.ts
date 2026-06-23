// Timezone-aware date helpers. All event timestamps are stored as UTC instants;
// the dashboard must bucket them by the user's *local* calendar day/week/month,
// otherwise activity near midnight lands on the wrong day. These helpers convert
// a UTC instant to civil parts in an IANA timezone (e.g. 'America/New_York') and
// compute local calendar boundaries as the UTC instants the DB filters on.
//
// No external dependency: everything is derived from Intl.DateTimeFormat, which
// knows the full IANA tz database including DST transitions.

// Offset to ADD to a UTC instant to get the wall-clock time in `timeZone`, in ms.
// e.g. for America/New_York in summer this is -4h.
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const m: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') m[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asUTC - instant.getTime();
}

// Civil calendar parts of a UTC instant as seen in `timeZone`.
export function partsInTz(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; weekday: number } {
  const key = dayKeyInTz(instant, timeZone);
  const [year, month, day] = key.split('-').map(Number);
  const offset = tzOffsetMs(instant, timeZone);
  const local = new Date(instant.getTime() + offset);
  return {
    year,
    month,
    day,
    hour: local.getUTCHours(),
    // weekday 0=Sun..6=Sat for the local date
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

// 'YYYY-MM-DD' of `instant` as seen in `timeZone` (en-CA formats as ISO date).
export function dayKeyInTz(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

// Weekday (0=Sun..6=Sat) of `instant` in `timeZone`.
export function weekdayInTz(instant: Date, timeZone: string): number {
  return partsInTz(instant, timeZone).weekday;
}

// Hour (0-23) of `instant` in `timeZone`.
export function hourInTz(instant: Date, timeZone: string): number {
  return partsInTz(instant, timeZone).hour;
}

// UTC instant of a local civil wall-clock time in `timeZone`.
// Single-pass offset estimate; exact except inside the ~1h DST-transition gap,
// which never coincides with the midnight boundaries we compute here.
export function zonedCivilToUtc(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const asUTC = Date.UTC(year, month - 1, day, hour, 0, 0);
  const offset = tzOffsetMs(new Date(asUTC), timeZone);
  return new Date(asUTC - offset);
}

// UTC instant of local midnight (start of the calendar day) containing `instant`.
export function startOfDayInTz(instant: Date, timeZone: string): Date {
  const { year, month, day } = partsInTz(instant, timeZone);
  return zonedCivilToUtc(year, month, day, 0, timeZone);
}

// UTC instant of local midnight `days` after the local day containing `instant`.
export function addLocalDays(instant: Date, days: number, timeZone: string): Date {
  const { year, month, day } = partsInTz(instant, timeZone);
  // Build the target civil date via UTC arithmetic on the date parts (DST-safe:
  // we re-resolve the offset for the resulting civil midnight).
  const target = new Date(Date.UTC(year, month - 1, day + days));
  return zonedCivilToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    0,
    timeZone,
  );
}
