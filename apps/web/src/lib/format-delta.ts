// Format a period-over-period change for display.
//
// `delta` is the fractional change from the prior period (0.12 = +12%, 5 = +500%),
// or null when there's no comparable prior value. `value` is the current metric.
//
// Always renders the signed percentage (▲ +467% / ▼ -40%), so the number is literal.
// The one special case: when there's no comparable prior value (delta null — e.g. the
// prior period was zero), there's no percentage to compute, so it renders a neutral "—".
export function formatDelta(
  delta: number | null,
  value: number | null,
): { text: string; tone: 'up' | 'down' | 'neutral' } {
  // No comparable prior value → no % to show, so render a neutral dash (consistent
  // with how other "nothing to compute" states read across the app).
  if (delta === null) return { text: '—', tone: 'neutral' };
  if (delta === 0) return { text: '0%', tone: 'neutral' };
  const tone = delta > 0 ? 'up' : 'down';
  const arrow = delta > 0 ? '▲' : '▼';
  // Always the signed percentage — even large gains ("▲ +467%") — so it reads as a
  // real number. A down arrow with a bare "100%" reads ambiguously, so keep the sign.
  const sign = delta > 0 ? '+' : '-';
  return { text: `${arrow} ${sign}${Math.round(Math.abs(delta) * 100)}%`, tone };
}

// A hover-tooltip explanation of a period-over-period delta, spelling out the
// (now − prior) ÷ prior math behind the number. The prior is reconstructed from
// `current` and the (rounded) delta — shown with a ~ since it's derived, not measured
// — except at −100%, where the prior isn't recoverable because current fell to zero.
export function explainDelta(
  current: number | null,
  prev: number | null | undefined,
  window: string,
  unit?: string,
): string {
  const w = window || 'period';
  const u = unit ? ` ${unit}` : '';
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (current === null) return `No data yet this ${w}.`;
  if (prev === null || prev === undefined) return `Nothing in the matching span last ${w} to compare against.`;
  if (prev === 0) {
    return `${fmt(current)}${u} so far this ${w} vs 0 by the same point last ${w} — no prior value to calculate a % from.`;
  }
  const pct = Math.round(((current - prev) / prev) * 100);
  const signed = `${pct > 0 ? '+' : ''}${pct}%`;
  // Dead-clear and succinct: the two real numbers being compared (this period's
  // elapsed slice vs the prior period's matching slice) and the exact division.
  return `${fmt(current)}${u} so far this ${w} vs ${fmt(prev)} by the same point last ${w}  →  (${fmt(current)} − ${fmt(prev)}) ÷ ${fmt(prev)} = ${signed}`;
}
