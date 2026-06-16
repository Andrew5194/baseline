'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { colorForCategory } from '../../lib/categories';

interface CategoryTrendProps {
  // Each row: { date, [category]: hours, ... }
  data: Array<Record<string, number | string>>;
  categories: string[];
}

export function CategoryTrend({ data, categories }: CategoryTrendProps) {
  if (data.length === 0 || categories.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
        No trend data yet
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} className="dark:opacity-20" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} unit="h" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', padding: '6px 10px' }}
            formatter={(value: number, name: string) => [`${value}h`, name]}
          />
          {categories.map((c) => (
            <Area
              key={c}
              type="monotone"
              dataKey={c}
              stackId="hours"
              stroke={colorForCategory(c)}
              fill={colorForCategory(c)}
              fillOpacity={0.65}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
