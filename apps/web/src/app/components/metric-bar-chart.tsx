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

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export function MetricBarChart({
  data,
  unit = '',
  todayISO,
  onSelectBar,
}: {
  data: Point[];
  unit?: string;
  todayISO?: string;
  onSelectBar?: (date: string) => void;
}) {
  const { ref, width } = useChartWidth();
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } = useTooltip<Point>();
  const [hovered, setHovered] = useState<string | null>(null);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const compact = data.length <= 7;
  const x = scaleBand<string>({ domain: data.map((d) => d.date), range: [0, innerW], padding: data.length > 45 ? 0.1 : 0.28 });
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const y = scaleLinear<number>({ domain: [0, maxVal * 1.1], range: [innerH, 0] });
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

            {data.map((d) => {
              const bx = x(d.date) ?? 0;
              const top = y(d.value);
              const h = innerH - top;
              const dimmed = hovered !== null && hovered !== d.date;
              return (
                <g key={d.date} style={{ opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s ease' }}>
                  {h > 0 && <path d={roundedTop(bx, top, bw, h, Math.min(3, bw / 2))} fill="url(#metric-bar-grad)" />}
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
                </g>
              );
            })}

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
    </div>
  );
}
