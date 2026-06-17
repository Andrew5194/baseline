'use client';

import { useState } from 'react';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { useChartWidth } from './use-chart-width';

interface TrendChartProps {
  data: Array<{ date: string; value: number }>;
  unit: string;
}

const HEIGHT = 256;
const MARGIN = { top: 12, right: 10, bottom: 22, left: 40 };
const ACCENT = '#10b981';

const fmtShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function TrendChart({ data, unit }: TrendChartProps) {
  const { ref, width } = useChartWidth();
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
        No data for this period
      </div>
    );
  }

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const n = data.length;
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  const x = scaleLinear<number>({ domain: [0, Math.max(1, n - 1)], range: [0, innerW] });
  const y = scaleLinear<number>({ domain: [0, maxVal * 1.15], range: [innerH, 0] });
  const yTicks = y.ticks(4);
  const step = Math.max(1, Math.ceil(n / 6));

  const activePt = active !== null ? data[active] : null;

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const px = e.clientX - el.getBoundingClientRect().left - MARGIN.left;
    const idx = Math.round(x.invert(Math.max(0, Math.min(innerW, px))));
    setActive(Math.max(0, Math.min(n - 1, idx)));
  }

  return (
    <div ref={ref} className="relative h-64 text-neutral-200 dark:text-neutral-800">
      {width > 0 && (
        <svg width={width} height={HEIGHT}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Group left={MARGIN.left} top={MARGIN.top}>
            {yTicks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '4 5'}
                opacity={t === 0 ? 0.9 : 0.55}
              />
            ))}
            {yTicks.map((t) => (
              <text key={`l${t}`} x={-8} y={y(t)} dy={4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {t}
              </text>
            ))}

            <AreaClosed
              data={data}
              x={(_d, i) => x(i)}
              y={(d) => y(d.value)}
              yScale={y}
              curve={curveMonotoneX}
              fill="url(#trend-fill)"
            />
            <LinePath
              data={data}
              x={(_d, i) => x(i)}
              y={(d) => y(d.value)}
              curve={curveMonotoneX}
              stroke={ACCENT}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {activePt && (
              <>
                <Line from={{ x: x(active!), y: 0 }} to={{ x: x(active!), y: innerH }} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                <circle cx={x(active!)} cy={y(activePt.value)} r={5} fill={ACCENT} stroke="white" strokeWidth={2} className="dark:[stroke:#171717]" />
              </>
            )}

            {data.map((d, i) =>
              i % step === 0 ? (
                <text key={`x${i}`} x={x(i)} y={innerH + 15} textAnchor="middle" fontSize={11} fill="#9ca3af">
                  {fmtShort(d.date)}
                </text>
              ) : null,
            )}

            <rect x={0} y={0} width={innerW} height={innerH} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setActive(null)} />
          </Group>
        </svg>
      )}

      {activePt && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          style={{ left: Math.min(width - 90, MARGIN.left + x(active!) + 8), top: MARGIN.top + y(activePt.value) - 8 }}
        >
          <div className="font-medium text-neutral-900 dark:text-white">{new Date(activePt.date + 'T00:00:00').toLocaleDateString()}</div>
          <div className="text-neutral-500 dark:text-neutral-400 tabular-nums">
            {activePt.value} {unit}
          </div>
        </div>
      )}
    </div>
  );
}
