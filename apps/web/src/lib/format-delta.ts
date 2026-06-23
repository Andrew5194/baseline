// Format a period-over-period change for display.
//
// `delta` is the fractional change from the prior period (0.12 = +12%, 5 = +500%),
// or null when there's no comparable prior value. `value` is the current metric.
//
// Two readability rules, since raw percentages mislead at the extremes:
//   • Large positive changes read as a multiplier ("6×") instead of a giant percent
//     ("500%") — clearer when the prior period was tiny.
//   • A metric that's nonzero now but had no prior activity reads as "new" rather
//     than a suppressed "—" (you can't take a percentage of zero).
// Negative deltas are bounded at −100% (counts can't drop below zero), so they
// always render as a plain percentage.
export function formatDelta(
  delta: number | null,
  value: number | null,
): { text: string; tone: 'up' | 'down' | 'neutral' } {
  if (delta === null) {
    if (value !== null && value > 0) return { text: 'new', tone: 'up' };
    return { text: '—', tone: 'neutral' };
  }
  const tone = delta >= 0 ? 'up' : 'down';
  const arrow = delta >= 0 ? '▲' : '▼';
  const abs = Math.abs(delta);
  if (delta >= 1) {
    const mult = abs + 1; // ratio of current to prior
    const m = mult >= 10 ? Math.round(mult) : Math.round(mult * 10) / 10;
    return { text: `${arrow} ${m}×`, tone };
  }
  return { text: `${arrow} ${Math.round(abs * 100)}%`, tone };
}
