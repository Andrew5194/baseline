'use client';

import { useState, useEffect, useRef, useReducer } from 'react';
import { Pie } from '@visx/shape';
import { Group } from '@visx/group';
import { colorForCategory, FREE_COLOR, FREE_FOCUS_COLOR, FREE_FOCUS_SWATCH, adjustLightness } from '../../lib/categories';
import { type TimeUnit, UNIT_META, fmtDuration, fmtDurationNum } from '../../lib/time-units';
import { RecurringIcon } from './recurring-icon';

export interface BudgetCategory {
  category: string;
  hours: number;
  pct: number;
  // Count of real logged events behind `hours` (manual, timer, or calendar). Recurring
  // routines are 0 — their hours are a planned allocation, not logged events.
  entries: number;
}

interface BudgetDonutProps {
  categories: BudgetCategory[];
  trackedHours: number;
  freeHours: number;
  budget: number;
  colorOf?: (category: string) => string;
  // When provided, legend swatches become color pickers that persist the choice.
  onRecolor?: (category: string, color: string) => void;
  // Notified whenever the hovered category changes (donut slice or legend row), so a
  // parent can cross-highlight the same category elsewhere (e.g. the bar chart).
  onActiveChange?: (category: string | null) => void;
  // Clicking a legend category opens its detail breakdown.
  onSelectCategory?: (category: string) => void;
  // Categories sourced from a recurring routine, marked with a repeat glyph.
  recurringCategories?: string[];
  // When true, recurring routines are hidden and free time is shown in green.
  freeFocus?: boolean;
  // Display unit for all hour figures (min/hr/day).
  unit?: TimeUnit;
  // Clicking the donut's center cycles the unit (min → hr → day).
  onCycleUnit?: () => void;
  // A live timer session accumulating on `category` — folded into the totals in
  // real time, with a shimmer on that slice. Cleared (discarded/logged) → reverts.
  pending?: { category: string; hours: number; running: boolean } | null;
}

interface Slice {
  name: string;
  value: number;
  color: string;
  free: boolean;
  pct: number;
}

const SIZE = 208;
const RADIUS = SIZE / 2 - 6;
const THICK = 26;
// Inner-hole diameter. The center figure's font shrinks to fit this so long numbers
// (e.g. thousands of minutes over a year) don't spill past the donut's edges.
const CENTER_W = 2 * (RADIUS - THICK);
function fitFontPx(str: string, maxPx: number): number {
  const availPx = CENTER_W - 28; // leave room for the button's horizontal padding
  const needed = availPx / (0.62 * Math.max(str.length, 1)); // ~digit width at tabular-nums
  return Math.min(maxPx, Math.max(13, needed));
}
const FREE_SWATCH = '#94a3b8';
const gradId = (name: string) => `donut-grad-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
// Always one decimal so percentages stay consistent and don't flicker between e.g.
// "0.9", "1", "1.1" while the hide-recurring tween runs.
const fmt1 = (n: number) => n.toFixed(1);

// Count up 0 → value once on mount, then hand off to the live value so a running
// timer (and the hide-recurring tween) keep updating the number afterward. The intro
// scales the *live* value by an eased 0 → 1 progress (rather than capturing a
// mount-time target), clamped at 0 — so it always starts at 0 and never flashes a
// negative while displayTracked settles for a frame.
function useCountUp(target: number, durationMs = 1150): number {
  const [k, setK] = useState(0); // eased intro progress, 0 → 1
  const doneRef = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current = true;
      setK(1);
      return;
    }
    const start = performance.now();
    // ease-in-out: a slow start so the low numbers actually tick by (not front-loaded).
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setK(ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        doneRef.current = true;
        setK(1);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Intro plays exactly once; live changes flow through the doneRef branch below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (doneRef.current) return target;
  return Math.max(0, target) * k;
}

export function BudgetDonut({ categories, trackedHours, budget, colorOf, onRecolor, onActiveChange, onSelectCategory, recurringCategories, freeFocus, unit = 'hr', onCycleUnit, pending }: BudgetDonutProps) {
  const baseColor = colorOf ?? ((c: string) => colorForCategory(c));
  // Fold a live timer session into the totals: add its hours to the matching category
  // (or introduce a new one), so the donut grows in real time and reverts when cleared.
  const pendingCat = pending && pending.hours > 0 ? pending.category : null;
  const pendingHours = pendingCat ? pending!.hours : 0;
  const effCategories: BudgetCategory[] = !pendingCat
    ? categories
    : categories.some((c) => c.category === pendingCat)
      ? categories.map((c) => (c.category === pendingCat ? { ...c, hours: c.hours + pendingHours } : c))
      : [...categories, { category: pendingCat, hours: pendingHours, pct: 0, entries: 0 }];
  const effTracked = trackedHours + pendingHours;
  const freeColor = freeFocus ? FREE_FOCUS_COLOR : FREE_COLOR;
  const freeSwatch = freeFocus ? FREE_FOCUS_SWATCH : FREE_SWATCH;
  const recurringSet = new Set(recurringCategories ?? []);
  // Rows actually rendered: in focus mode, recurring routines are hidden. Drive the
  // empty state AND the Free row's divider off THIS (not the raw list), so a fully
  // filtered-out table doesn't leave the header + Free borders as two empty lines.
  const shownCategories = effCategories.filter((c) => !(freeFocus && recurringSet.has(c.category)));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const colorVal = (c: string) => draft[c] ?? baseColor(c);
  const [active, setActive] = useState<string | null>(null);
  // Update the local highlight and notify the parent (for cross-highlighting the bar chart).
  const changeActive = (c: string | null) => {
    setActive(c);
    onActiveChange?.(c);
  };

  // Tween 0 → 1 (show routines → free focus) so the arcs grow/shrink smoothly each
  // frame, instead of jumping via a CSS path morph.
  const target = freeFocus ? 1 : 0;
  const progressRef = useRef(target);
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const start = progressRef.current;
    if (start === target) return;
    const startTime = performance.now();
    const dur = 480;
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / dur);
      progressRef.current = start + (target - start) * ease(p);
      force();
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const progress = progressRef.current;

  // Hiding recurring reframes the donut around free time: pool shrinks to `freeBudget`
  // (budget minus routines), recurring slices shrink to 0, "Untracked" is the rest.
  // Driven by `progress` (0..1) for a smooth tween.
  const recurringTotal = Math.round(effCategories.filter((c) => recurringSet.has(c.category)).reduce((s, c) => s + c.hours, 0) * 10) / 10;
  const freeBudget = budget - recurringTotal * progress;
  // Keep unrounded so a running timer ticks smoothly at the display unit's precision
  // (fmtDuration rounds later). Rounding to hundredths-of-an-hour here makes minutes
  // jump in coarse 0.6-min steps.
  const displayTracked = effTracked - recurringTotal * progress;
  const displayFree = freeBudget - displayTracked;
  // Intro count-up for the hero figure (falls through to the live value once done).
  const animatedTracked = useCountUp(displayTracked);

  // Clockwise draw-in: a wedge clip grows 0 → 360° from the top once on mount, so
  // the ring fills in clockwise. Dropped when complete to avoid clipping artifacts.
  const [sweep, setSweep] = useState(0);
  const sweepDoneRef = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      sweepDoneRef.current = true;
      setSweep(1);
      return;
    }
    const start = performance.now();
    const dur = 950;
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setSweep(ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        sweepDoneRef.current = true;
        setSweep(1);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const slicePct = (hours: number) => (freeBudget > 0 ? Math.round((hours / freeBudget) * 1000) / 10 : 0);

  const orderedCats = [
    ...effCategories.filter((c) => c.hours > 0 && !recurringSet.has(c.category)),
    ...effCategories.filter((c) => c.hours > 0 && recurringSet.has(c.category)),
  ];
  const slices: Slice[] = [
    ...orderedCats.map((c) => ({
      name: c.category,
      value: recurringSet.has(c.category) ? c.hours * (1 - progress) : c.hours,
      color: colorVal(c.category),
      free: false,
      pct: slicePct(c.hours),
    })),
    {
      name: freeFocus ? 'Focus time' : 'Free',
      value: displayFree,
      color: freeColor,
      free: true,
      pct: slicePct(displayFree),
    },
    // Drop fully-collapsed slices (e.g. recurring as it shrinks to 0) so visx's
    // padAngle doesn't reserve an empty gap where they used to be.
  ].filter((s) => s.value > 0.05);

  const pct = freeBudget > 0 ? Math.round((displayTracked / freeBudget) * 100) : 0;
  const freePct = slicePct(displayFree);
  const activeSlice = slices.find((s) => s.name === active) ?? null;

  // Floor every slice at a fixed angular size (~0.58° of the ring) so a small category
  // reads the same in week, month, AND year — without it, tiny year categories go
  // sub-pixel and vanish. `drawValue` is render-only; center figure, tooltips, and
  // legend use real hours, and Free absorbs the gap.
  const realTotal = slices.reduce((sum, s) => sum + s.value, 0);
  const minSlice = realTotal > 0 ? realTotal * 0.0016 : 0;
  const boost = slices.reduce((sum, s) => (s.free ? sum : sum + Math.max(0, minSlice - s.value)), 0);
  const drawSlices = slices.map((s) => ({
    ...s,
    drawValue: s.free ? Math.max(0.01, s.value - boost) : Math.max(s.value, minSlice),
  }));

  // Wedge that covers the donut and grows clockwise from 12 o'clock as `sweep` → 1.
  const sweepActive = !sweepDoneRef.current && sweep < 1;
  const swC = SIZE / 2;
  const swR = SIZE; // large enough to fully cover the ring
  const sweepDeg = Math.min(359.999, sweep * 360);
  const swPt = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180; // -90° = top; increasing deg = clockwise
    return `${swC + swR * Math.cos(a)},${swC + swR * Math.sin(a)}`;
  };
  const sweepPath = `M${swC},${swC} L${swPt(0)} A${swR},${swR} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${swPt(sweepDeg)} Z`;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE}>
          <defs>
            {effCategories.map((c) => {
              const base = colorVal(c.category);
              return (
                <linearGradient key={c.category} id={gradId(c.category)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={adjustLightness(base, 9)} />
                  <stop offset="52%" stopColor={base} />
                  <stop offset="100%" stopColor={adjustLightness(base, -7)} />
                </linearGradient>
              );
            })}
            {/* Free-time gradient — a faint translucent emerald glow when focusing on free time */}
            <linearGradient id="donut-grad-free" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.28)" />
              <stop offset="55%" stopColor="rgba(16,185,129,0.16)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.08)" />
            </linearGradient>
            {/* Intro clockwise-fill wedge */}
            <clipPath id="donut-sweep-clip">
              <path d={sweepPath} />
            </clipPath>
          </defs>
          <g clipPath={sweepActive ? 'url(#donut-sweep-clip)' : undefined}>
          <Group top={SIZE / 2} left={SIZE / 2}>
            <Pie
              data={drawSlices}
              pieValue={(d) => d.drawValue}
              pieSortValues={null}
              innerRadius={RADIUS - THICK}
              outerRadius={(arc) => (active === arc.data.name ? RADIUS + 4 : RADIUS)}
              cornerRadius={3}
              padAngle={0.022}
            >
              {(pie) =>
                pie.arcs.map((arc) => {
                  const s = arc.data;
                  const d = pie.path(arc) ?? undefined;
                  const dim = active && active !== s.name ? 0.45 : 1;
                  // Free is two stacked arcs (grey + green) on the same path; the
                  // value tween grows the arc and `progress` crossfades the colour.
                  if (s.free) {
                    return (
                      <g key={s.name} onMouseEnter={() => changeActive(s.name)} onMouseLeave={() => changeActive(null)} style={{ cursor: 'default' }}>
                        <path d={d} fill={FREE_COLOR} opacity={(1 - progress) * dim} />
                        <path d={d} fill="url(#donut-grad-free)" opacity={progress * dim} />
                      </g>
                    );
                  }
                  return (
                    <path
                      key={s.name}
                      d={d}
                      fill={`url(#${gradId(s.name)})`}
                      onMouseEnter={() => changeActive(s.name)}
                      onMouseLeave={() => changeActive(null)}
                      style={{ transition: 'opacity 0.15s ease', cursor: 'default' }}
                      opacity={dim}
                    />
                  );
                })
              }
            </Pie>
          </Group>
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={onCycleUnit}
            disabled={!onCycleUnit}
            title={onCycleUnit ? 'Click to change time unit (min · hr · day)' : undefined}
            className={`flex flex-col items-center justify-center rounded-full px-4 text-center ${onCycleUnit ? 'pointer-events-auto cursor-pointer' : ''}`}
            style={{ width: CENTER_W, height: CENTER_W }}
          >
            {activeSlice ? (
              <>
                <span
                  className="font-bold text-neutral-900 dark:text-white tabular-nums leading-tight"
                  style={{ fontSize: fitFontPx(fmtDuration(activeSlice.value, unit), 24) }}
                >
                  {fmtDuration(activeSlice.value, unit)}
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-[7rem] truncate">{activeSlice.name}</span>
                <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mt-0.5 tabular-nums">{fmt1(activeSlice.pct)}% of budget</span>
              </>
            ) : (
              <>
                <span
                  className="font-bold text-neutral-900 dark:text-white tabular-nums leading-tight"
                  // Size from the final value so the intro count-up doesn't resize the font.
                  style={{ fontSize: fitFontPx(fmtDurationNum(displayTracked, unit), 30) }}
                >
                  {fmtDurationNum(animatedTracked, unit)}
                </span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">of {fmtDurationNum(freeBudget, unit)} {freeFocus ? 'free' : 'total'} {UNIT_META[unit].word}</span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">{pct}% {freeFocus ? 'focused' : 'tracked'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full">
        {/* Column headers for the per-category table. */}
        <div className="flex items-baseline gap-2.5 pb-1.5 mb-1.5 border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          <span className="w-2.5 flex-shrink-0" />
          <span className="flex-1 min-w-0">Allocation</span>
          <span className="w-12 text-right flex-shrink-0">Entries</span>
          <span className="w-20 text-right flex-shrink-0">Time Logged</span>
          <span className="w-12 text-right flex-shrink-0">% Total</span>
        </div>
        <div className="space-y-2">
          {shownCategories.map((c) => (
              <div
                key={c.category}
                className={`flex items-baseline gap-2.5 text-sm rounded-md -mx-1 px-1 py-0.5 transition-colors ${
                  onSelectCategory ? 'cursor-pointer' : ''
                } ${c.category === pendingCat && pending?.running ? 'legend-shimmer' : ''}`}
                style={{ backgroundColor: active === c.category ? 'rgba(148,163,184,0.12)' : 'transparent' }}
                onMouseEnter={() => changeActive(c.category)}
                onMouseLeave={() => changeActive(null)}
                onClick={() => onSelectCategory?.(c.category)}
                title={onSelectCategory ? `See the entries behind ${c.category}` : undefined}
              >
                {onRecolor ? (
                  <label
                    className="relative w-2.5 h-2.5 flex-shrink-0 cursor-pointer self-center"
                    title={`Change ${c.category} color`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorVal(c.category) }} />
                    <input
                      type="color"
                      aria-label={`Color for ${c.category}`}
                      value={colorVal(c.category)}
                      onChange={(e) => setDraft((d) => ({ ...d, [c.category]: e.target.value }))}
                      onBlur={(e) => onRecolor(c.category, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </label>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 self-center" style={{ backgroundColor: colorVal(c.category) }} />
                )}
                <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                  <span className="text-neutral-700 dark:text-neutral-300 truncate">{c.category}</span>
                  {recurringSet.has(c.category) && (
                    <span className="text-neutral-400 dark:text-neutral-500 self-center flex-shrink-0" title="Recurring routine">
                      <RecurringIcon className="w-3 h-3" />
                    </span>
                  )}
                </span>
                <span className="w-12 text-right text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums flex-shrink-0">{c.entries}</span>
                <span className="w-20 text-right text-neutral-900 dark:text-white font-medium tabular-nums flex-shrink-0 whitespace-nowrap">{fmtDuration(c.hours, unit)}</span>
                <span className="w-12 text-right text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums flex-shrink-0">{fmt1(slicePct(c.hours))}%</span>
              </div>
            ))}
          <div
            className={`flex items-baseline gap-2.5 text-sm pt-2 ${
              shownCategories.length > 0 ? 'border-t border-neutral-100 dark:border-neutral-800' : ''
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 self-center" style={{ backgroundColor: freeSwatch }} />
            <span className="flex-1 min-w-0 truncate text-neutral-400 dark:text-neutral-500">{freeFocus ? 'Focus time' : 'Free'}</span>
            <span className="w-12 text-right text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums flex-shrink-0">—</span>
            <span className="w-20 text-right text-neutral-500 dark:text-neutral-400 font-medium tabular-nums flex-shrink-0 whitespace-nowrap">{fmtDuration(displayFree, unit)}</span>
            <span className="w-12 text-right text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums flex-shrink-0">{fmt1(freePct)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
