'use client';

import { useState } from 'react';
import { Pie } from '@visx/shape';
import { Group } from '@visx/group';
import { colorForCategory, FREE_COLOR, adjustLightness } from '../../lib/categories';
import { RecurringIcon } from './recurring-icon';

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
  // Categories sourced from a recurring routine, marked with a repeat glyph.
  recurringCategories?: string[];
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
const FREE_SWATCH = '#94a3b8';
const gradId = (name: string) => `donut-grad-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;

export function BudgetDonut({ categories, trackedHours, freeHours, budget, colorOf, onRecolor, recurringCategories }: BudgetDonutProps) {
  const baseColor = colorOf ?? ((c: string) => colorForCategory(c));
  const recurringSet = new Set(recurringCategories ?? []);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const colorVal = (c: string) => draft[c] ?? baseColor(c);
  const [active, setActive] = useState<string | null>(null);

  const slices: Slice[] = [
    ...categories.map((c) => ({
      name: c.category,
      value: c.hours,
      color: colorVal(c.category),
      free: false,
      pct: c.pct,
    })),
    {
      name: 'Free',
      value: freeHours,
      color: FREE_COLOR,
      free: true,
      pct: budget > 0 ? Math.round((freeHours / budget) * 1000) / 10 : 0,
    },
  ].filter((s) => s.value > 0);

  const pct = budget > 0 ? Math.round((trackedHours / budget) * 100) : 0;
  const freePct = budget > 0 ? Math.round((freeHours / budget) * 1000) / 10 : 0;
  const activeSlice = slices.find((s) => s.name === active) ?? null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE}>
          <defs>
            {categories.map((c) => {
              const base = colorVal(c.category);
              return (
                <linearGradient key={c.category} id={gradId(c.category)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={adjustLightness(base, 9)} />
                  <stop offset="52%" stopColor={base} />
                  <stop offset="100%" stopColor={adjustLightness(base, -7)} />
                </linearGradient>
              );
            })}
          </defs>
          <Group top={SIZE / 2} left={SIZE / 2}>
            <Pie
              data={slices}
              pieValue={(d) => d.value}
              pieSortValues={null}
              innerRadius={RADIUS - THICK}
              outerRadius={(arc) => (active === arc.data.name ? RADIUS + 4 : RADIUS)}
              cornerRadius={3}
              padAngle={0.022}
            >
              {(pie) =>
                pie.arcs.map((arc) => {
                  const s = arc.data;
                  return (
                    <path
                      key={s.name}
                      d={pie.path(arc) ?? undefined}
                      fill={s.free ? FREE_COLOR : `url(#${gradId(s.name)})`}
                      onMouseEnter={() => setActive(s.name)}
                      onMouseLeave={() => setActive(null)}
                      style={{ transition: 'opacity 0.15s ease', cursor: 'default' }}
                      opacity={active && active !== s.name ? 0.45 : 1}
                    />
                  );
                })
              }
            </Pie>
          </Group>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          {activeSlice ? (
            <>
              <span className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">{activeSlice.value}h</span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-[7rem] truncate">{activeSlice.name}</span>
              <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mt-0.5 tabular-nums">{activeSlice.pct}% of budget</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">{trackedHours}</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">of {budget.toLocaleString()} h</span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">{pct}% tracked</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No tracked hours yet.</p>
        ) : (
          categories.map((c) => (
            <div
              key={c.category}
              className="flex items-center gap-2.5 text-sm rounded-md -mx-1 px-1 py-0.5 transition-colors"
              style={{ backgroundColor: active === c.category ? 'rgba(148,163,184,0.12)' : 'transparent' }}
              onMouseEnter={() => setActive(c.category)}
              onMouseLeave={() => setActive(null)}
            >
              {onRecolor ? (
                <label className="relative w-2.5 h-2.5 flex-shrink-0 cursor-pointer" title={`Change ${c.category} color`}>
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
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colorVal(c.category) }} />
              )}
              <span className="text-neutral-700 dark:text-neutral-300 truncate">{c.category}</span>
              {recurringSet.has(c.category) && (
                <span className="text-neutral-400 dark:text-neutral-500" title="Recurring routine">
                  <RecurringIcon className="w-3 h-3" />
                </span>
              )}
              <span className="flex-1" />
              <span className="text-neutral-900 dark:text-white font-medium tabular-nums">{c.hours}h</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 w-10 text-right tabular-nums">{c.pct}%</span>
            </div>
          ))
        )}
        <div className="flex items-center gap-2.5 text-sm pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: FREE_SWATCH }} />
          <span className="text-neutral-400 dark:text-neutral-500 flex-1">Free</span>
          <span className="text-neutral-500 dark:text-neutral-400 font-medium tabular-nums">{freeHours}h</span>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 w-10 text-right tabular-nums">{freePct}%</span>
        </div>
      </div>
    </div>
  );
}
