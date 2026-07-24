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
  if (delta === 0) return { text: '0%', tone: 'neutral' };
  const tone = delta > 0 ? 'up' : 'down';
  const arrow = delta > 0 ? '▲' : '▼';
  const abs = Math.abs(delta);
  if (delta >= 1) {
    const mult = abs + 1; // ratio of current to prior
    const m = mult >= 10 ? Math.round(mult) : Math.round(mult * 10) / 10;
    return { text: `${arrow} ${m}×`, tone };
  }
  // Keep the signed percentage — a down arrow with a bare "100%" reads ambiguously;
  // "▼ -100%" / "▲ +25%" makes the direction unmistakable.
  const sign = delta > 0 ? '+' : '-';
  return { text: `${arrow} ${sign}${Math.round(abs * 100)}%`, tone };
}

// A hover-tooltip explanation of a period-over-period delta, spelling out the
// (now − prior) ÷ prior math behind the number. The prior is reconstructed from
// `current` and the (rounded) delta — shown with a ~ since it's derived, not measured
// — except at −100%, where the prior isn't recoverable because current fell to zero.
export function explainDelta(
  current: number | null,
  delta: number | null,
  window: string,
  unit?: string,
): string {
  const w = window || 'period';
  const u = unit ? ` ${unit}` : '';
  // The comparison is always against the SAME elapsed slice of the prior period —
  // e.g. 5 days into this week vs the first 5 days of last week — not the full prior
  // period. The wording ("so far this week" vs "by the same point last week") makes
  // that explicit so a partial period isn't read as a drop against a complete one.
  const samePoint = `by the same point last ${w}`;
  if (delta === null) {
    return current !== null && current > 0
      ? `New — no prior ${w} to compare this against yet.`
      : `No comparable prior ${w} to compare against yet.`;
  }
  if (delta === 0) return `No change vs ${samePoint}.`;
  const pct = Math.round(Math.abs(delta) * 100);
  const signed = `${delta > 0 ? '+' : '-'}${pct}%`;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const cur = current !== null ? fmt(current) : '0';
  if (delta <= -1) {
    return `${cur}${u} so far this ${w}, down from a nonzero total ${samePoint} — a ${signed} change. Measured against the same elapsed span, not the full ${w}.`;
  }
  const prior = current !== null ? current / (1 + delta) : null;
  if (prior !== null && Number.isFinite(prior)) {
    return `${cur}${u} so far this ${w} vs ~${fmt(prior)}${u} ${samePoint} — change = (${cur} − ${fmt(prior)}) ÷ ${fmt(prior)} = ${signed}. Measured against the same elapsed span, not the full ${w}.`;
  }
  return `${signed} vs ${samePoint} — (now − prior) ÷ prior, measured against the same elapsed span of last ${w}.`;
}
