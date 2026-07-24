'use client';

import { useState } from 'react';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { useChartWidth } from './use-chart-width';
import { barLabel, fullLabel } from './chart-axis';
import { adjustLightness } from '../../lib/categories';

interface Point {
  date: string;
  value: number;
}

const HEIGHT = 256;
const MARGIN = { top: 12, right: 8, bottom: 22, left: 36 };
const ACCENT = '#10b981';
const AVG_COLOR = '#3b82f6'; // the "expected average" reference line (matches marketing)

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export function MetricBarChart({
  data,
  unit = '',
  todayISO,
  onSelectBar,
  average = null,
  averageLabel = '',
  averageInfo = '',
  yMax,
}: {
  data: Point[];
  unit?: string;
  todayISO?: string;
  onSelectBar?: (date: string) => void;
  average?: number | null; // server-computed all-time per-bucket baseline (line position)
  averageLabel?: string; // fully-formatted label drawn at the line
  averageInfo?: string; // how the baseline was derived (shown when the line is clicked)
  yMax?: number; // fixed axis ceiling (e.g. days-per-bucket) so a % line lands at its true height
}) {
  const { ref, width } = useChartWidth();
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } = useTooltip<Point>();
  const [hovered, setHovered] = useState<string | null>(null);
  const [avgOpen, setAvgOpen] = useState(false);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const compact = data.length <= 7;
  const x = scaleBand<string>({ domain: data.map((d) => d.date), range: [0, innerW], padding: data.length > 45 ? 0.1 : 0.28 });
  // Fixed ceiling (yMax) keeps a percentage-style line at its true height; else scale
  // to the data, including the baseline so its line is always within range.
  const domainMax = yMax ?? Math.max(1, ...data.map((d) => d.value), average ?? 0) * 1.1;
  const y = scaleLinear<number>({ domain: [0, domainMax], range: [innerH, 0] });
  const bw = x.bandwidth();
  const yTicks = y.ticks(4).filter((t) => Number.isInteger(t));

  // Label density mirrors the Overview chart; today + month starts always shown.
  const maxLabels = Math.max(1, Math.floor(innerW / (compact ? 30 : 18)));
  const step = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <div ref={ref} className="relative h-64 text-neutral-200 dark:text-neutral-800">
      {data.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
          No data for this period
        </div>
      ) : width > 0 ? (
        <svg width={width} height={HEIGHT}>
          <defs>
            <linearGradient id="metric-bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={adjustLightness(ACCENT, 8)} />
              <stop offset="52%" stopColor={ACCENT} />
              <stop offset="100%" stopColor={adjustLightness(ACCENT, -6)} />
            </linearGradient>
          </defs>
          <Group left={MARGIN.left} top={MARGIN.top}>
            {yTicks.map((t) => (
              <line key={t} x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="currentColor" strokeWidth={1} strokeDasharray={t === 0 ? undefined : '4 5'} opacity={t === 0 ? 0.9 : 0.55} />
            ))}
            {yTicks.map((t) => (
              <text key={`l${t}`} x={-8} y={y(t)} dy={4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {t}
              </text>
            ))}

            {/* Baseline-line click target, under the bars so bars keep hover priority;
                clickable over empty days and gaps between bars. */}
            {average != null && average > 0 && averageInfo && (
              <rect x={0} y={y(average) - 7} width={innerW} height={14} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => setAvgOpen((o) => !o)} />
            )}

            {data.map((d) => {
              const bx = x(d.date) ?? 0;
              const top = y(d.value);
              const h = innerH - top;
              const dimmed = hovered !== null && hovered !== d.date;
              return (
                <g key={d.date} style={{ opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s ease' }}>
                  {h > 0 && <path d={roundedTop(bx, top, bw, h, Math.min(3, bw / 2))} fill="url(#metric-bar-grad)" />}
                  {/* Hit area only where a bar exists — empty days aren't interactive. */}
                  {d.value > 0 && (
                    <rect
                      x={bx}
                      y={0}
                      width={bw}
                      height={innerH}
                      fill="transparent"
                      style={{ cursor: onSelectBar ? 'pointer' : 'default' }}
                      onMouseEnter={() => {
                        setHovered(d.date);
                        showTooltip({ tooltipLeft: MARGIN.left + bx + bw / 2, tooltipTop: MARGIN.top + top - 8, tooltipData: d });
                      }}
                      onMouseLeave={() => {
                        setHovered(null);
                        hideTooltip();
                      }}
                      onClick={() => onSelectBar?.(d.date)}
                    />
                  )}
                </g>
              );
            })}

            {average != null && average > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={0} x2={innerW} y1={y(average)} y2={y(average)} stroke={AVG_COLOR} strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={innerW} y={y(average) - 5} textAnchor="end" fontSize={10} fontWeight={600} fill={AVG_COLOR}>
                  {averageLabel}
                </text>
              </g>
            )}

            {data.map((d, i) => {
              const isToday = !!todayISO && d.date === todayISO;
              const isMonthStart = !compact && d.date.endsWith('-01');
              if (!(i % step === 0 || isToday || isMonthStart)) return null;
              return (
                <text
                  key={`x${d.date}`}
                  x={(x(d.date) ?? 0) + bw / 2}
                  y={innerH + 15}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={isToday || isMonthStart ? 600 : 400}
                  fill={isToday ? ACCENT : isMonthStart ? '#6b7280' : '#9ca3af'}
                >
                  {barLabel(d.date, compact)}
                </text>
              );
            })}
          </Group>
        </svg>
      ) : null}

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={{ position: 'absolute', pointerEvents: 'none' }}>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <div className="font-medium text-neutral-900 dark:text-white">{fullLabel(tooltipData.date)}</div>
            <div className="text-neutral-500 dark:text-neutral-400 tabular-nums">
              {tooltipData.value} {unit}
            </div>
          </div>
        </TooltipWithBounds>
      )}

      {avgOpen && averageInfo && average != null && (
        <>
          <div className="absolute inset-0 z-10" onClick={() => setAvgOpen(false)} />
          <div
            className="absolute z-20 max-w-[280px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] leading-snug shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
            style={
              y(average) > innerH / 2
                ? { bottom: HEIGHT - (MARGIN.top + y(average)) + 10, right: 8 }
                : { top: MARGIN.top + y(average) + 10, right: 8 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <span className="font-semibold" style={{ color: AVG_COLOR }}>
                How the baseline is calculated
              </span>
              <button
                onClick={() => setAvgOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-0.5 flex-shrink-0 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-neutral-600 dark:text-neutral-300">{averageInfo}</div>
          </div>
        </>
      )}
    </div>
  );
}
