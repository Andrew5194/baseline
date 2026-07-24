// A user-selectable display unit for durations across the Overview. Values are
// stored/computed in hours everywhere; this only changes how they're shown.
export type TimeUnit = 'min' | 'hr' | 'day';

export const UNIT_META: Record<TimeUnit, { factor: number; suffix: string; word: string; label: string }> = {
  min: { factor: 60, suffix: 'm', word: 'minutes', label: 'Min' },
  hr: { factor: 1, suffix: 'h', word: 'hours', label: 'Hr' },
  day: { factor: 1 / 24, suffix: 'd', word: 'days', label: 'Day' },
};

export const isTimeUnit = (v: string): v is TimeUnit => v === 'min' || v === 'hr' || v === 'day';

// Formatted number only: up to two decimals, trailing zeros dropped (whole stays whole,
// a tenth stays a tenth). Thousands-grouped — e.g. "75", "75.8", "75.83".
export function fmtDurationNum(hours: number, unit: TimeUnit): string {
  const v = hours * UNIT_META[unit].factor;
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Formatted number + unit suffix, e.g. "75.8h", "4,548m", "3.2d".
export function fmtDuration(hours: number, unit: TimeUnit): string {
  return `${fmtDurationNum(hours, unit)}${UNIT_META[unit].suffix}`;
}
