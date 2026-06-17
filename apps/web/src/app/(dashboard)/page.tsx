'use client';

import { useState, useEffect, useCallback } from 'react';
import { PeriodSelector, periodRangeLabel, type Period } from '../components/period-selector';
import { BudgetDonut, type BudgetCategory } from '../components/budget-donut';
import { DailyAllocationBars } from '../components/daily-allocation-bars';
import { AddTimeEntryForm } from '../components/add-time-entry-form';
import { RecurringAllocations } from '../components/recurring-allocations';
import { Modal } from '../components/modal';
import { apiFetch } from '../../lib/api';
import { buildColorMap, colorForCategory } from '../../lib/categories';

interface BudgetResponse {
  budget: number;
  tracked_hours: number;
  free_hours: number;
  categories: BudgetCategory[];
}
interface Entry {
  id: string;
  occurred_at: string;
  hours: number;
  category: string;
  note: string | null;
}
interface EntriesResponse {
  data: Entry[];
  categories: string[];
}
interface TrendResponse {
  categories: string[];
  granularity: 'day' | 'month';
  data: Array<{ date: string; by_category: Record<string, number> }>;
}

const DAY_HOURS = 24;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type Panel = 'recurring';
const PERIOD_LABEL: Record<Period, string> = { week: 'This week', month: 'This month', year: 'This year' };

export default function Overview() {
  const [period, setPeriod] = useState<Period>('week');
  const [budget, setBudget] = useState<BudgetResponse | null>(null);
  const [entries, setEntries] = useState<EntriesResponse | null>(null);
  const [daily, setDaily] = useState<TrendResponse | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [recurringCats, setRecurringCats] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  // 'new' = add modal; an Entry = edit modal; null = closed.
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);

  const loadBudget = useCallback(
    () =>
      apiFetch<BudgetResponse>(`/v1/metrics/time-allocation?period=${period}`)
        .then(setBudget)
        .catch(console.error),
    [period],
  );
  const loadColors = useCallback(
    () =>
      apiFetch<{ colors: Record<string, string> }>('/v1/category-colors')
        .then((d) => setColors(d.colors ?? {}))
        .catch(console.error),
    [],
  );
  const loadRecurring = useCallback(
    () =>
      apiFetch<{ data: Array<{ category: string }> }>('/v1/recurring-allocations')
        .then((d) => setRecurringCats([...new Set((d.data ?? []).map((r) => r.category))]))
        .catch(console.error),
    [],
  );
  const loadPeriod = useCallback(() => {
    apiFetch<EntriesResponse>(`/v1/time-entries?period=${period}`).then(setEntries).catch(console.error);
    apiFetch<TrendResponse>(`/v1/metrics/time-allocation/timeseries?period=${period}`)
      .then(setDaily)
      .catch(console.error);
  }, [period]);

  useEffect(() => {
    loadColors();
    loadRecurring();
  }, [loadColors, loadRecurring]);
  useEffect(() => {
    loadBudget();
    loadPeriod();
  }, [loadBudget, loadPeriod]);

  const refreshAll = () => {
    loadBudget();
    loadPeriod();
    loadRecurring();
  };

  async function deleteEntry(id: string) {
    await apiFetch(`/v1/time-entries/${id}`, { method: 'DELETE' }).catch(console.error);
    refreshAll();
  }

  async function recolor(category: string, color: string) {
    await apiFetch('/v1/category-colors', {
      method: 'PUT',
      body: JSON.stringify({ category, color }),
    }).catch(console.error);
    loadColors();
  }

  // The chart's scale follows the FETCHED data's granularity (daily.granularity),
  // not `period`. Otherwise a period switch flips the scale synchronously while the
  // previous period's data is still loading, briefly rendering e.g. year totals on a
  // 24h axis (bars shoot off the top) until the refetch lands.
  const granularity = daily?.granularity ?? 'day';
  const isYear = granularity === 'month';
  const capacityFor = (iso: string) => {
    if (!isYear) return DAY_HOURS;
    const [y, m] = iso.split('-').map(Number);
    return DAY_HOURS * new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based → day 0 = last day of month
  };
  const categories = daily?.categories ?? [];
  const barRows =
    daily?.data.map((d) => {
      const row: Record<string, number | string> = { date: d.date };
      let sum = 0;
      for (const c of categories) {
        const h = d.by_category[c] ?? 0;
        row[c] = h;
        sum += h;
      }
      row.Free = Math.round(Math.max(capacityFor(d.date) - sum, 0) * 10) / 10;
      return row;
    }) ?? [];
  // y-axis ceiling: 24h for day views, a full 31-day month (744h) for the year.
  const yMax = isYear ? DAY_HOURS * 31 : DAY_HOURS;
  // Key of the bucket containing today, used to emphasize today's bar. For the
  // year view (monthly buckets) that's the 1st of the current month.
  const now = new Date();
  const todayKey =
    granularity === 'month'
      ? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
      : now.toISOString().split('T')[0];

  // Stack recurring routines (sleep, meals) together at the bottom of each bar so
  // the variable, one-off categories sit on top — making day-to-day changes obvious.
  const RECURRING_STACK_PRIORITY = ['Breakfast', 'Lunch', 'Dinner', 'Sleep'];
  const recurringSet = new Set(recurringCats);
  const recurringInChart = categories
    .filter((c) => recurringSet.has(c))
    .sort((a, b) => {
      const ia = RECURRING_STACK_PRIORITY.indexOf(a);
      const ib = RECURRING_STACK_PRIORITY.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  const variableInChart = categories.filter((c) => !recurringSet.has(c));
  const stackCategories = [...recurringInChart, ...variableInChart];

  // Every category the user has touched, with a distinct color (overrides win).
  const allCategories = [
    ...new Set([
      ...categories,
      ...(entries?.categories ?? []),
      ...(budget?.categories.map((c) => c.category) ?? []),
    ]),
  ].sort();
  const colorMap = buildColorMap(allCategories, colors);
  const colorOf = (c: string) => colorMap[c] ?? colorForCategory(c, colors);

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const tabClass = (p: Panel) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      panel === p
        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
        : 'border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
    }`;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{periodRangeLabel(period)}</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing('new')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              <span className="text-sm leading-none">+</span>
              Add entry
            </button>
            <button onClick={() => togglePanel('recurring')} className={tabClass('recurring')}>
              Recurring
            </button>
          </div>
        </div>
      </div>

      {editing !== null && (
        <Modal onClose={() => setEditing(null)}>
          <AddTimeEntryForm
            entry={editing === 'new' ? null : editing}
            knownCategories={allCategories}
            onClose={() => setEditing(null)}
            onSuccess={refreshAll}
            onDelete={
              editing === 'new'
                ? undefined
                : async () => {
                    await deleteEntry(editing.id);
                    setEditing(null);
                  }
            }
          />
        </Modal>
      )}

      {panel === 'recurring' && (
        <div className="mb-6">
          <RecurringAllocations knownCategories={allCategories} colorOf={colorOf} onChange={refreshAll} />
        </div>
      )}

      {/* Budget donut for the selected period */}
      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-5">
          {PERIOD_LABEL[period]}
        </p>
        {budget ? (
          <BudgetDonut
            categories={budget.categories}
            trackedHours={budget.tracked_hours}
            freeHours={budget.free_hours}
            budget={budget.budget}
            colorOf={colorOf}
            onRecolor={recolor}
            recurringCategories={recurringCats}
          />
        ) : (
          <div className="h-[200px] bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
        )}
      </div>

      {/* Allocation over the period — each bar reads as a 24h day */}
      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-5">
          {isYear ? 'Monthly allocation' : 'Daily allocation'}
        </p>
        {daily ? (
          <DailyAllocationBars data={barRows} categories={stackCategories} colorOf={colorOf} todayISO={todayKey} yMax={yMax} recurringCategories={recurringCats} />
        ) : (
          <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
        )}
      </div>

      {/* Entries list */}
      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">
          Entries · {PERIOD_LABEL[period].toLowerCase()}
        </p>
        {!entries ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
            ))}
          </div>
        ) : entries.data.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4">
            No entries yet. Click <span className="font-medium">Add entry</span> to log time.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {entries.data.map((e) => (
              <div
                key={e.id}
                onClick={() => setEditing(e)}
                className="flex items-center gap-3 py-2.5 group cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colorOf(e.category) }}
                />
                <span className="text-sm text-neutral-900 dark:text-white w-32 truncate">{e.category}</span>
                <span className="text-xs text-neutral-400 dark:text-neutral-500 w-16">{fmtDate(e.occurred_at)}</span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400 flex-1 truncate">{e.note}</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-white tabular-nums">{e.hours}h</span>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteEntry(e.id);
                  }}
                  aria-label="Delete entry"
                  className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
