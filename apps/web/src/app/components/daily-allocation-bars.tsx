'use client';

import { useState, useEffect, useRef, useReducer } from 'react';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { colorForCategory, FREE_COLOR, FREE_FOCUS_SWATCH, adjustLightness } from '../../lib/categories';
import { type TimeUnit, fmtDuration } from '../../lib/time-units';
import { useChartWidth } from './use-chart-width';
import { RecurringIcon } from './recurring-icon';
import { barLabel, fullLabel } from './chart-axis';

interface DailyAllocationBarsProps {
  // Each row: { date (ISO YYYY-MM-DD), [category]: hours, Free }. Each bar fills to capacity.
  data: Array<Record<string, number | string>>;
  categories: string[];
  colorOf?: (category: string) => string;
  // Today's bucket key; its bar's axis label is rendered bold + accented.
  todayISO?: string;
  // y-axis ceiling (24 for a day; the month's total for the year view).
  yMax?: number;
  // Categories sourced from a recurring routine, marked in the tooltip.
  recurringCategories?: string[];
  // When true, recurring routines are hidden and free time is shown in green.
  freeFocus?: boolean;
  // A live, unsaved timer session accumulating on `date` — drawn as a translucent
  // segment growing into that day's free time.
  pending?: { date: string; category: string; hours: number; running: boolean } | null;
  // Display unit for hour figures (axis labels, totals, tooltip).
  unit?: TimeUnit;
}

const FREE_KEY = 'Free';
const FREE_SWATCH = '#94a3b8'; // solid slate-400 so "Free" reads clearly in the tooltip
const HEIGHT = 256;
const MARGIN = { top: 18, right: 8, bottom: 22 };
const RADIUS = 4;
const SEG_GAP = 1.5; // thin gap between stacked segments for a crisp, modern look
const ACCENT = '#10b981';

const gradId = (key: string) => `bar-grad-${key.replace(/[^a-zA-Z0-9]/g, '-')}`;

// Path for a rectangle with only its top corners rounded.
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

interface TooltipRow {
  iso: string;
  total: number;
  segments: Array<{ key: string; value: number; color: string }>;
}

export function DailyAllocationBars({ data, categories, colorOf, todayISO, yMax = 24, recurringCategories, freeFocus, pending, unit = 'hr' }: DailyAllocationBarsProps) {
  const color = colorOf ?? ((c: string) => colorForCategory(c));
  const freeSwatch = freeFocus ? FREE_FOCUS_SWATCH : FREE_SWATCH;
  const recurringSet = new Set(recurringCategories ?? []);
  const { ref, width } = useChartWidth();
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<TooltipRow>();
  const [hovered, setHovered] = useState<string | null>(null);

  // Tween 0 → 1 (show routines → focus on free time) so each bar smoothly shrinks
  // from 24h to (24h − recurring) and the colours crossfade, instead of snapping.
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

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
        No data yet — add an entry to see your time fill up.
      </div>
    );
  }

  const marginLeft = yMax > 99 ? 42 : 30;
  const innerW = Math.max(0, width - marginLeft - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const compact = data.length <= 7;
  // Stack order: recurring routines at the bottom, non-recurring above, Free on top. So
  // hiding recurring shrinks it away at the base and the variable work settles down.
  const keys = [...categories, FREE_KEY];

  const dates = data.map((d) => String(d.date));
  const x = scaleBand<string>({ domain: dates, range: [0, innerW], padding: data.length > 45 ? 0.08 : 0.26 });
  const yScale = scaleLinear<number>({ domain: [0, yMax], range: [innerH, 0] });
  const bw = x.bandwidth();
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yMax * i) / 4));

  const maxLabels = Math.max(1, Math.floor(innerW / 18));
  const step = Math.ceil(data.length / maxLabels);

  return (
    <div ref={ref} className="relative h-64 text-neutral-200 dark:text-neutral-800">
      {width > 0 && (
        <svg width={width} height={HEIGHT}>
          <defs>
            {categories.map((c) => {
              const base = color(c);
              return (
                <linearGradient key={c} id={gradId(c)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={adjustLightness(base, 8)} />
                  <stop offset="52%" stopColor={base} />
                  <stop offset="100%" stopColor={adjustLightness(base, -6)} />
                </linearGradient>
              );
            })}
            {/* Free-time gradient — a faint translucent emerald glow when focusing on free time */}
            <linearGradient id="bar-grad-free" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.3)" />
              <stop offset="55%" stopColor="rgba(16,185,129,0.16)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.07)" />
            </linearGradient>
          </defs>
          <Group left={marginLeft} top={MARGIN.top}>
            {/* Gridlines: dashed inner lines + a soft baseline */}
            {yTicks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={innerW}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '4 5'}
                opacity={t === 0 ? 0.9 : 0.55}
              />
            ))}
            {yTicks.map((t) => (
              <text key={`l${t}`} x={-8} y={yScale(t)} dy={4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {fmtDuration(t, unit)}
              </text>
            ))}

            {data.map((row) => {
              const iso = String(row.date);
              const bx = x(iso) ?? 0;
              const dimmed = hovered !== null && hovered !== iso;

              // Focusing on free time removes recurring: those segments shrink by
              // `progress`, Free stays, so the total falls from 24h toward (24h − recurring).
              let acc = 0;
              const segs = keys
                .map((key) => {
                  const raw = Number(row[key]) || 0;
                  const value = key !== FREE_KEY && recurringSet.has(key) ? raw * (1 - progress) : raw;
                  return { key, raw, value };
                })
                .filter((s) => s.raw > 0 || s.key === FREE_KEY)
                .map((s) => {
                  const seg = { key: s.key, value: s.value, y0: acc, y1: acc + s.value };
                  acc += s.value;
                  return seg;
                });
              const total = acc;
              const clipId = `clip-${iso}`;
              // Live timer overlay: a translucent slab growing up from where free time
              // begins, into the free zone of this day's bar.
              const pend = pending && pending.date === iso && total > 0 ? pending : null;
              const trackedTop = segs.find((s) => s.key === FREE_KEY)?.y0 ?? total;
              const pendEnd = pend ? Math.min(total, trackedTop + pend.hours) : trackedTop;

              return (
                <Group
                  key={iso}
                  style={{ opacity: dimmed ? 0.32 : 1, transition: 'opacity 0.15s ease' }}
                >
                  <clipPath id={clipId}>
                    <path d={roundedTop(bx, yScale(total), bw, innerH - yScale(total), RADIUS)} />
                  </clipPath>
                  <Group clipPath={`url(#${clipId})`}>
                    {segs.map((s, i) => {
                      const isBottom = i === 0;
                      const top = yScale(s.y1);
                      const h = Math.max(0, yScale(s.y0) - yScale(s.y1) - (isBottom ? 0 : SEG_GAP));
                      return (
                        s.key === FREE_KEY ? (
                          // Two stacked rects (grey + green) on the same geometry; the
                          // tween moves the geometry and `progress` crossfades colour.
                          <g key={s.key}>
                            <rect x={bx} y={top} width={bw} height={h} fill={FREE_COLOR} opacity={1 - progress} />
                            <rect x={bx} y={top} width={bw} height={h} fill="url(#bar-grad-free)" opacity={progress} />
                          </g>
                        ) : (
                          <rect key={s.key} x={bx} y={top} width={bw} height={h} fill={`url(#${gradId(s.key)})`} />
                        )
                      );
                    })}
                    {/* Live, unsaved timer time growing into free space */}
                    {pend && pendEnd > trackedTop && (
                      <rect
                        x={bx}
                        y={yScale(pendEnd)}
                        width={bw}
                        height={Math.max(0, yScale(trackedTop) - yScale(pendEnd))}
                        fill={color(pend.category)}
                        opacity={0.4}
                      />
                    )}
                  </Group>
                  {/* Transparent hover target */}
                  <rect
                    x={bx}
                    y={0}
                    width={bw}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => {
                      setHovered(iso);
                      showTooltip({
                        tooltipLeft: marginLeft + bx + bw / 2,
                        tooltipTop: MARGIN.top + yScale(total) - 8,
                        tooltipData: {
                          iso,
                          total: Math.round(total * 10) / 10,
                          segments: segs
                            .slice()
                            .reverse()
                            // When focusing on free time, recurring routines are hidden
                            // from the bar — so drop them from the tooltip too.
                            .filter((s) => !(freeFocus && recurringSet.has(s.key)))
                            .map((s) => ({
                              key: s.key,
                              value: s.value,
                              color: s.key === FREE_KEY ? freeSwatch : color(s.key),
                            })),
                        },
                      });
                    }}
                    onMouseLeave={() => {
                      setHovered(null);
                      hideTooltip();
                    }}
                  />
                  {/* Total label above the hovered bar */}
                  {hovered === iso && total > 0 && (
                    <text
                      x={bx + bw / 2}
                      y={yScale(total) - 7}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill="currentColor"
                      className="text-neutral-700 dark:text-neutral-200"
                    >
                      {fmtDuration(total, unit)}
                    </text>
                  )}
                </Group>
              );
            })}

            {/* x-axis labels */}
            {data.map((row, i) => {
              const iso = String(row.date);
              const isToday = !!todayISO && iso === todayISO;
              const isMonthStart = !compact && iso.endsWith('-01');
              if (!(i % step === 0 || isToday || isMonthStart)) return null;
              return (
                <text
                  key={`x${iso}`}
                  x={(x(iso) ?? 0) + bw / 2}
                  y={innerH + 15}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={isToday || isMonthStart ? 600 : 400}
                  fill={isToday ? ACCENT : isMonthStart ? '#6b7280' : '#9ca3af'}
                >
                  {barLabel(iso, compact)}
                </text>
              );
            })}
          </Group>
        </svg>
      )}

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={{ position: 'absolute', pointerEvents: 'none' }}>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <span className="font-medium text-neutral-900 dark:text-white">{fullLabel(tooltipData.iso)}</span>
              <span className="text-neutral-400 dark:text-neutral-500 tabular-nums">{fmtDuration(tooltipData.total, unit)}</span>
            </div>
            {tooltipData.segments.map((s) => {
              const isFree = s.key === FREE_KEY;
              return (
                <div key={s.key} className="flex items-center gap-1.5 py-0.5">
                  <span
                    className={`w-2 h-2 flex-shrink-0 ${isFree ? 'rounded-full' : 'rounded-sm'}`}
                    style={{ backgroundColor: s.color }}
                  />
                  <span className={isFree ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'}>
                    {isFree && freeFocus ? 'Focus time' : s.key}
                  </span>
                  {recurringSet.has(s.key) && (
                    <span className="text-neutral-400 dark:text-neutral-500" title="Recurring routine">
                      <RecurringIcon className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <span className="ml-auto pl-4 font-medium text-neutral-900 dark:text-white tabular-nums">{fmtDuration(s.value, unit)}</span>
                </div>
              );
            })}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}
