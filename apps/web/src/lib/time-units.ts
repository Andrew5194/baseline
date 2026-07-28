// A user-selectable display unit for durations across the Overview. Values are
// stored/computed in hours everywhere; this only changes how they're shown.
export type TimeUnit = 'min' | 'hr' | 'day';

export const UNIT_META: Record<TimeUnit, { factor: number; suffix: string; word: string; label: string }> = {
  min: { factor: 60, suffix: 'm', word: 'minutes', label: 'Min' },
  hr: { factor: 1, suffix: 'h', word: 'hours', label: 'Hr' },
  day: { factor: 1 / 24, suffix: 'd', word: 'days', label: 'Day' },
};

export const isTimeUnit = (v: string): v is TimeUnit => v === 'min' || v === 'hr' || v === 'day';

// Smallest increment a duration shows at, expressed back in hours. Durations render to
// 0.01 of the unit, so this is the grid a live timer should step along — one shown step
// is 0.01 min = 0.6s, 0.01 hr = 36s, 0.01 day = 14.4min. Quantizing the live value to
// this grid (and re-rendering when it crosses a step) makes the counter climb by an even
// 0.01 instead of the coarse, uneven jumps a fixed 1s tick produces at the minute level.
export const stepHours = (unit: TimeUnit): number => 0.01 / UNIT_META[unit].factor;
export const quantizeHours = (hours: number, unit: TimeUnit): number => {
  const step = stepHours(unit);
  return Math.floor(hours / step) * step;
};

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
