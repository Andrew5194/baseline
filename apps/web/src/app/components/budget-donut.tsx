'use client';

import { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { colorForCategory, FREE_COLOR } from '../../lib/categories';

export interface BudgetCategory {
  category: string;
  hours: number;
  pct: number;
}

interface BudgetDonutProps {
  categories: BudgetCategory[];
  trackedHours: number;
  freeHours: number;
  budget: number;
  colorOf?: (category: string) => string;
  // When provided, legend swatches become color pickers that persist the choice.
  onRecolor?: (category: string, color: string) => void;
}

export function BudgetDonut({ categories, trackedHours, freeHours, budget, colorOf, onRecolor }: BudgetDonutProps) {
  const baseColor = colorOf ?? ((c: string) => colorForCategory(c));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const color = (c: string) => draft[c] ?? baseColor(c);
  const data = [
    ...categories.map((c) => ({ name: c.category, value: c.hours, color: color(c.category) })),
    { name: 'Free', value: freeHours, color: FREE_COLOR },
  ];
  const pct = budget > 0 ? Math.round((trackedHours / budget) * 100) : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="relative w-[200px] h-[200px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={72}
              outerRadius={96}
              paddingAngle={1}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">{trackedHours}</span>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">of {budget} h</span>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">{pct}% tracked</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No tracked hours this week yet.</p>
        ) : (
          categories.map((c) => (
            <div key={c.category} className="flex items-center gap-2.5 text-sm">
              {onRecolor ? (
                <label className="relative w-2.5 h-2.5 flex-shrink-0 cursor-pointer" title={`Change ${c.category} color`}>
                  <span className="block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color(c.category) }} />
                  <input
                    type="color"
                    aria-label={`Color for ${c.category}`}
                    value={color(c.category)}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.category]: e.target.value }))}
                    onBlur={(e) => onRecolor(c.category, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              ) : (
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color(c.category) }} />
              )}
              <span className="text-neutral-700 dark:text-neutral-300 flex-1 truncate">{c.category}</span>
              <span className="text-neutral-900 dark:text-white font-medium tabular-nums">{c.hours}h</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 w-10 text-right tabular-nums">
                {c.pct}%
              </span>
            </div>
          ))
        )}
        <div className="flex items-center gap-2.5 text-sm pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: FREE_COLOR }} />
          <span className="text-neutral-400 dark:text-neutral-500 flex-1">Free</span>
          <span className="text-neutral-500 dark:text-neutral-400 font-medium tabular-nums">{freeHours}h</span>
        </div>
      </div>
    </div>
  );
}
