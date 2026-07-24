// Format a period-over-period change. `delta` is the fractional change from the prior
// period (0.12 = +12%, 5 = +500%), or null when there's no comparable prior value (e.g.
// prior was zero). `value` is the current metric. Always renders the signed percentage
// (▲ +467% / ▼ -40%); a null delta has no % to compute, so it renders a neutral "—".
export function formatDelta(
  delta: number | null,
  value: number | null,
): { text: string; tone: 'up' | 'down' | 'neutral' } {
  // No comparable prior value → no % to show; neutral dash (matches other
  // "nothing to compute" states across the app).
  if (delta === null) return { text: '—', tone: 'neutral' };
  if (delta === 0) return { text: '0%', tone: 'neutral' };
  const tone = delta > 0 ? 'up' : 'down';
  const arrow = delta > 0 ? '▲' : '▼';
  // Always signed — even large gains ("▲ +467%") — so it reads as a real number; a down
  // arrow with a bare "100%" is ambiguous, so keep the sign.
  const sign = delta > 0 ? '+' : '-';
  return { text: `${arrow} ${sign}${Math.round(Math.abs(delta) * 100)}%`, tone };
}

// A hover-tooltip explanation of a period-over-period delta, spelling out the
// (now − prior) ÷ prior math behind the number.
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
  // Show the two real numbers compared (this period's elapsed slice vs the prior's
  // matching slice) and the exact division.
  return `${fmt(current)}${u} so far this ${w} vs ${fmt(prev)} by the same point last ${w}  →  (${fmt(current)} − ${fmt(prev)}) ÷ ${fmt(prev)} = ${signed}`;
}
