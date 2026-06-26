// Timezone-aware helper: the local-date keys for every day of the current month.

import { addLocalDays, zonedCivilToUtc, partsInTz, dayKeyInTz } from '@baseline/metrics';

export function monthDayKeys(now: Date, tz: string): string[] {
  const { year, month } = partsInTz(now, tz);
  const start = zonedCivilToUtc(year, month, 1, 0, tz);
  const end = zonedCivilToUtc(year, month + 1, 1, 0, tz);
  const out: string[] = [];
  let s = start;
  while (s.getTime() < end.getTime()) {
    out.push(dayKeyInTz(s, tz));
    s = addLocalDays(s, 1, tz);
  }
  return out;
}
