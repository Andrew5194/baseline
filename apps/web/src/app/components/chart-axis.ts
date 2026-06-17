// Shared x-axis labelling for the time-bucketed bar charts (Overview allocation +
// Metrics), so week/month/year read identically across the app.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Bar label: compact "M/D" on short windows (week); otherwise TradingView-style —
// the day number for every bar, with the month abbreviation on the 1st. Monthly
// buckets (year view) are dated `YYYY-MM-01`, so they naturally render as months.
export function barLabel(iso: string, compact: boolean): string {
  const [, m, d] = iso.split('-');
  if (compact) return `${Number(m)}/${Number(d)}`;
  return Number(d) === 1 ? MONTHS[Number(m) - 1] : String(Number(d));
}

// Friendly full date for tooltips, e.g. "Jun 16".
export function fullLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}
