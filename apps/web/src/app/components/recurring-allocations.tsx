'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../lib/api';
import { PRESET_CATEGORIES, ROUTINE_PRESETS } from '../../lib/categories';

interface RecurringAllocation {
  id: string;
  category: string | null;
  hours: number;
  days_mask: number;
  note: string | null;
}

interface RecurringAllocationsProps {
  knownCategories: string[];
  colorOf: (category: string) => string;
  onChange: () => void; // refetch budget/bars in the parent
}

const CUSTOM = '__custom__';
const ALL_DAYS = 127;
const WEEKDAYS = 0b0111110; // Mon–Fri (bits 1–5)
const WEEKENDS = 0b1000001; // Sun + Sat (bits 0 and 6)
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

function describeDays(mask: number): string {
  if (mask === ALL_DAYS) return 'Every day';
  if (mask === WEEKDAYS) return 'Weekdays';
  if (mask === WEEKENDS) return 'Weekends';
  const days = DAY_NAMES.filter((_, i) => (mask & (1 << i)) !== 0);
  return days.length ? days.join(', ') : 'Never';
}

export function RecurringAllocations({ knownCategories, colorOf, onChange }: RecurringAllocationsProps) {
  const [items, setItems] = useState<RecurringAllocation[]>([]);
  const [category, setCategory] = useState('Sleep');
  const [customCategory, setCustomCategory] = useState('');
  const [hours, setHours] = useState('');
  const [daysMask, setDaysMask] = useState(ALL_DAYS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const options = [...new Set([...PRESET_CATEGORIES, ...ROUTINE_PRESETS.map((p) => p.category), ...knownCategories])];

  const load = useCallback(() => {
    fetch(`${API_URL}/v1/recurring-allocations`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setItems(d.data ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(payload: { category: string; hours: number; days_mask: number }) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/recurring-allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to add allocation');
      }
      load();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add allocation');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cat = category === CUSTOM ? customCategory.trim() : category;
    if (!cat) return setError('Enter a category name');
    const h = parseFloat(hours);
    if (!(h > 0)) return setError('Enter hours greater than 0');
    if (daysMask === 0) return setError('Pick at least one day');
    await create({ category: cat, hours: h, days_mask: daysMask });
    setHours('');
    setCustomCategory('');
  }

  async function remove(id: string) {
    await fetch(`${API_URL}/v1/recurring-allocations/${id}`, { method: 'DELETE', credentials: 'include' }).catch(
      console.error,
    );
    load();
    onChange();
  }

  const existing = new Set(items.filter((i) => i.category).map((i) => (i.category as string).toLowerCase()));

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
      <div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">Recurring allocations</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Standing routines like sleep and meals — applied to every matching day automatically.
        </p>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {ROUTINE_PRESETS.map((p) => (
          <button
            key={p.category}
            type="button"
            disabled={loading || existing.has(p.category.toLowerCase())}
            onClick={() => create({ category: p.category, hours: p.hours, days_mask: ALL_DAYS })}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: colorOf(p.category) }} />
            {p.category} · {p.hours}h
          </button>
        ))}
      </div>

      {/* Existing list */}
      {items.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2 group">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: it.category ? colorOf(it.category) : '#9ca3af' }} />
              <span className={`text-sm w-32 truncate ${it.category ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500 italic'}`}>{it.category ?? 'Uncategorized'}</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 flex-1">{describeDays(it.days_mask)}</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white tabular-nums">{it.hours}h<span className="text-neutral-400 dark:text-neutral-500 font-normal">/day</span></span>
              <button
                onClick={() => remove(it.id)}
                aria-label="Delete recurring allocation"
                className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="ra-category" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Category
            </label>
            <select id="ra-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
            {category === CUSTOM && (
              <input
                type="text"
                placeholder="New category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className={`${inputClass} mt-2`}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ra-hours" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Hours per day
            </label>
            <input
              id="ra-hours"
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              required
              placeholder="e.g. 8"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Days</span>
            <div className="flex gap-1.5 text-[11px]">
              <button type="button" onClick={() => setDaysMask(ALL_DAYS)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                Every day
              </button>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <button type="button" onClick={() => setDaysMask(WEEKDAYS)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                Weekdays
              </button>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <button type="button" onClick={() => setDaysMask(WEEKENDS)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                Weekends
              </button>
            </div>
          </div>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((d, i) => {
              const on = (daysMask & (1 << i)) !== 0;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={DAY_NAMES[i]}
                  aria-pressed={on}
                  onClick={() => setDaysMask((m) => m ^ (1 << i))}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    on
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
        >
          {loading ? 'Adding…' : 'Add recurring'}
        </button>
      </form>
    </div>
  );
}
