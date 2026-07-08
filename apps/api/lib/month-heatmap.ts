// Timezone-aware helper: the local-date keys for every day of a month. `monthOffset`
// counts months back from the one containing `now` (0 = current, 1 = last month).

import { addLocalDays, zonedCivilToUtc, partsInTz, dayKeyInTz } from '@baseline/metrics';

export function monthDayKeys(now: Date, tz: string, monthOffset = 0): string[] {
  const { year, month } = partsInTz(now, tz);
  const start = zonedCivilToUtc(year, month - monthOffset, 1, 0, tz);
  const end = zonedCivilToUtc(year, month - monthOffset + 1, 1, 0, tz);
  const out: string[] = [];
  let s = start;
  while (s.getTime() < end.getTime()) {
    out.push(dayKeyInTz(s, tz));
    s = addLocalDays(s, 1, tz);
  }
  return out;
}
