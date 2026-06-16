'use client';

import { useMemo } from 'react';
import { Group } from '@visx/group';
import { scaleThreshold } from '@visx/scale';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';

export interface HeatmapDay {
  date: string;
  value: number;
}

interface CalendarHeatmapProps {
  /** Weeks as columns; each column is 7 rows (Sun..Sat), null = padding day. */
  weeks: (HeatmapDay | null)[][];
  maxCount: number;
  onHover?: (day: HeatmapDay | null) => void;
  onSelect?: (day: HeatmapDay) => void;
}

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const TOP_PAD = 18; // month labels
const LEFT_PAD = 22; // weekday labels

// Tailwind fill-* utilities keep the emerald scale theme-aware (light + dark).
const LEVEL_CLASS = [
  'fill-neutral-100 dark:fill-neutral-800',
  'fill-emerald-200 dark:fill-emerald-900',
  'fill-emerald-400 dark:fill-emerald-700',
  'fill-emerald-500',
  'fill-emerald-600 dark:fill-emerald-400',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS = [
  [1, 'Mon'],
  [3, 'Wed'],
  [5, 'Fri'],
] as const;

const parseDate = (d: string) => new Date(d + 'T00:00:00');

export function CalendarHeatmap({ weeks, maxCount, onHover, onSelect }: CalendarHeatmapProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<HeatmapDay>();

  // Threshold scale: value -> one of five theme-aware fill classes.
  const colorClass = useMemo(
    () =>
      scaleThreshold<number, string>({
        domain: [1, maxCount * 0.25, maxCount * 0.5, maxCount * 0.75],
        range: LEVEL_CLASS,
      }),
    [maxCount],
  );

  // One month label per column where the month first appears.
  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    let last = -1;
    weeks.forEach((week, wi) => {
      const firstDay = week.find(Boolean);
      if (!firstDay) return;
      const month = parseDate(firstDay.date).getMonth();
      if (month !== last) {
        labels.push({ x: LEFT_PAD + wi * STEP, label: MONTHS[month] });
        last = month;
      }
    });
    return labels;
  }, [weeks]);

  const width = LEFT_PAD + weeks.length * STEP;
  const height = TOP_PAD + 7 * STEP;

  const handleEnter = (day: HeatmapDay, x: number, y: number) => {
    onHover?.(day);
    showTooltip({ tooltipData: day, tooltipLeft: x + CELL, tooltipTop: y });
  };
  const handleLeave = () => {
    onHover?.(null);
    hideTooltip();
  };

  return (
    <div className="relative w-fit">
      <svg width={width} height={height} className="block">
        {monthLabels.map(({ x, label }) => (
          <text key={`${label}-${x}`} x={x} y={11} className="fill-neutral-400 dark:fill-neutral-500 text-[9px]">
            {label}
          </text>
        ))}
        {WEEKDAY_LABELS.map(([row, label]) => (
          <text
            key={label}
            x={0}
            y={TOP_PAD + row * STEP + CELL - 1}
            className="fill-neutral-400 dark:fill-neutral-500 text-[9px]"
          >
            {label}
          </text>
        ))}

        <Group left={LEFT_PAD} top={TOP_PAD}>
          {weeks.map((week, wi) =>
            week.map((day, ri) => {
              const x = wi * STEP;
              const y = ri * STEP;
              if (!day) return null;
              const interactive = day.value > 0;
              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  className={`${colorClass(day.value)} transition-[stroke] ${
                    interactive ? 'cursor-pointer' : ''
                  } ${tooltipData?.date === day.date ? 'stroke-2 stroke-emerald-400/70' : 'stroke-0'}`}
                  onMouseEnter={() => handleEnter(day, x, y)}
                  onMouseLeave={handleLeave}
                  onClick={() => interactive && onSelect?.(day)}
                />
              );
            }),
          )}
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          unstyled
          className="pointer-events-none absolute z-10 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <span className="font-semibold text-neutral-900 dark:text-white">{tooltipData.value}</span>
          <span className="text-neutral-500 dark:text-neutral-400">
            {' '}
            {tooltipData.value === 1 ? 'contribution' : 'contributions'}
          </span>
          <div className="text-neutral-400 dark:text-neutral-500">
            {parseDate(tooltipData.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

/** Legend swatches that mirror the heatmap's threshold scale. */
export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
      <span>Less</span>
      <div className="flex gap-1">
        {LEVEL_CLASS.map((cls) => (
          <svg key={cls} width={CELL} height={CELL} className="block">
            <rect width={CELL} height={CELL} rx={2} className={cls} />
          </svg>
        ))}
      </div>
      <span>More</span>
    </div>
  );
}
