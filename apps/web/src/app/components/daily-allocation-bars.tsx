'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { TooltipProps } from 'recharts';
import { colorForCategory, FREE_COLOR } from '../../lib/categories';

interface DailyAllocationBarsProps {
  // Each row: { date (ISO YYYY-MM-DD), [category]: hours, Free }. Each bar sums to 24h.
  data: Array<Record<string, number | string>>;
  categories: string[];
  colorOf?: (category: string) => string;
  // Today's ISO date; its bar's axis label is rendered bold + accented.
  todayISO?: string;
  // y-axis ceiling each bar fills to (24 for a day; the month's total for the year).
  yMax?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Bar axis label. Compact "M/D" on short windows (e.g. 7d); otherwise
// TradingView-style: day number for every bar, month abbreviation on the 1st.
function barLabel(iso: string, compact: boolean): string {
  const [, m, d] = iso.split('-');
  if (compact) return `${Number(m)}/${Number(d)}`;
  return Number(d) === 1 ? MONTHS[Number(m) - 1] : String(Number(d));
}

// Friendly full date for the tooltip header, e.g. "Jun 16".
function fullLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

// X-axis tick following TradingView convention; today is emphasized, and the
// month markers (1st of a month) are given the stronger neutral color.
function DateTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
  todayISO?: string;
  compact?: boolean;
}) {
  const { x = 0, y = 0, payload, todayISO, compact = false } = props;
  const iso = payload?.value ?? '';
  const isToday = !!todayISO && iso === todayISO;
  // Only the TradingView format gets a distinct month-marker treatment.
  const isMonthStart = !compact && iso.endsWith('-01');
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={11}
      fontWeight={isToday || isMonthStart ? 600 : 400}
      fill={isToday ? '#10b981' : isMonthStart ? '#6b7280' : '#9ca3af'}
    >
      {barLabel(iso, compact)}
    </text>
  );
}

const FREE_KEY = 'Free';

const FREE_SWATCH = '#94a3b8'; // solid slate-400 so "Free" reads clearly in the tooltip

// Readable tooltip: neutral text + swatches. Categories get colored squares;
// the "Free" remainder gets a gray circle so it's classified as unallocated.
function AllocationTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => typeof p.value === 'number' && p.value > 0);
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="font-medium text-neutral-900 dark:text-white mb-1">
        {typeof label === 'string' ? fullLabel(label) : label}
      </div>
      {rows.map((p) => {
        const isFree = p.dataKey === FREE_KEY;
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 flex-shrink-0 ${isFree ? 'rounded-full' : 'rounded-sm'}`}
              style={{ backgroundColor: isFree ? FREE_SWATCH : p.color }}
            />
            <span className={isFree ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'}>
              {String(p.dataKey)}
            </span>
            <span className="ml-auto pl-3 font-medium text-neutral-900 dark:text-white tabular-nums">{p.value}h</span>
          </div>
        );
      })}
    </div>
  );
}

export function DailyAllocationBars({ data, categories, colorOf, todayISO, yMax = 24 }: DailyAllocationBarsProps) {
  const color = colorOf ?? ((c: string) => colorForCategory(c));
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yMax * i) / 4));
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
        No data yet — add an entry to see your day fill up.
      </div>
    );
  }

  const dense = data.length > 45;
  // Short windows (e.g. 7d) use the compact M/D label; the day count fits easily.
  const compact = data.length <= 7;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={dense ? 1 : '15%'}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} className="dark:opacity-20" />
          <XAxis
            dataKey="date"
            tick={<DateTick todayISO={todayISO} compact={compact} />}
            tickLine={false}
            axisLine={false}
            // Label every bar on short windows (7d/30d); thin out on the dense 90d view.
            interval={dense ? 'preserveStartEnd' : 0}
            minTickGap={dense ? 24 : 4}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={yTicks}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={yMax > 99 ? 44 : 28}
            unit="h"
          />
          <Tooltip content={<AllocationTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
          {categories.map((c) => (
            <Bar key={c} dataKey={c} stackId="h" fill={color(c)} isAnimationActive={false} />
          ))}
          <Bar dataKey={FREE_KEY} stackId="h" fill={FREE_COLOR} radius={dense ? 0 : [3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
