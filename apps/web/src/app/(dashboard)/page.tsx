'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PeriodSelector, PeriodNav, periodRangeLabel, type Period } from '../components/period-selector';
import { BudgetDonut, type BudgetCategory } from '../components/budget-donut';
import { DailyAllocationBars } from '../components/daily-allocation-bars';
import { CalendarAllocation } from '../components/calendar-allocation';
import { AddTimeEntryForm } from '../components/add-time-entry-form';
import { FocusTimerBar } from '../components/focus-timer-bar';
import { useFocusTimer, elapsedMs } from '../../lib/focus-timer';
import { fmtDuration } from '../../lib/time-units';
import { useTimeUnit } from '../../lib/use-time-unit';
import { RecurringAllocations } from '../components/recurring-allocations';
import { ManageCategoriesModal } from '../components/manage-categories-modal';
import { Modal } from '../components/modal';
import { apiFetch } from '../../lib/api';
import { useTimezone } from '../../lib/use-timezone';
import { usePreference } from '../../lib/use-preference';
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
  timed?: boolean;
  task_id?: string | null;
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
const fmtDate = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });

const fmtTime = (d: Date, timeZone: string) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });

// For timer sessions, occurred_at is the end time — derive the start from the
// duration and show "start – end".
const timeRange = (iso: string, hours: number, timeZone: string) => {
  const end = new Date(iso);
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return `${fmtTime(start, timeZone)} – ${fmtTime(end, timeZone)}`;
};

type Panel = 'recurring' | 'categories';
const PERIOD_LABEL: Record<Period, string> = { week: 'This week', month: 'This month', year: 'This year' };
const ALLOCATION_LABEL: Record<Period, string> = { week: 'Next 7 days', month: 'Next 30 days', year: 'Next 12 months' };

export default function Overview() {
  const tz = useTimezone();
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0); // periods back from now (0 = current)
  const [budget, setBudget] = useState<BudgetResponse | null>(null);
  const [entries, setEntries] = useState<EntriesResponse | null>(null);
  const [daily, setDaily] = useState<TrendResponse | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [colorsReady, setColorsReady] = useState(false);
  const [recurringCats, setRecurringCats] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  // Synced server-side (users.preferences via /v1/me) so it follows the user across devices.
  const [hideRecurring, setHideRecurring] = usePreference('hideRecurring');
  const [allocView, setAllocView] = usePreference<'bars' | 'calendar'>('allocView', 'bars');
  const [unit, setUnit] = useTimeUnit();
  // 'new' = add modal; an Entry = edit modal; null = closed.
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  // The live focus timer — drives the "growing" pending block (re-renders each second).
  const activeTimer = useFocusTimer();

  // Always fetch the full picture (incl. recurring). Hiding routines is applied
  // client-side so the donut/bars can animate recurring → free smoothly.
  const loadBudget = useCallback(
    () =>
      apiFetch<BudgetResponse>(`/v1/metrics/time-allocation?period=${period}&offset=${offset}`)
        .then(setBudget)
        .catch(console.error),
    [period, offset],
  );
  const loadColors = useCallback(
    () =>
      apiFetch<{ colors: Record<string, string> }>('/v1/category-colors')
        .then((d) => setColors(d.colors ?? {}))
        .catch(console.error)
        .finally(() => setColorsReady(true)),
    [],
  );
  const loadRecurring = useCallback(
    () =>
      apiFetch<{ data: Array<{ category: string | null }> }>('/v1/recurring-allocations')
        .then((d) => setRecurringCats([...new Set((d.data ?? []).map((r) => r.category).filter((c): c is string => !!c))]))
        .catch(console.error),
    [],
  );
  const loadPeriod = useCallback(() => {
    apiFetch<EntriesResponse>(`/v1/time-entries?period=${period}&offset=${offset}`).then(setEntries).catch(console.error);
    apiFetch<TrendResponse>(`/v1/metrics/time-allocation/timeseries?period=${period}&offset=${offset}`)
      .then(setDaily)
      .catch(console.error);
  }, [period, offset]);

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
    // A data change here (time entry added/deleted, session logged) can change a
    // category's linked-item count. Tell the co-mounted categories panel to refresh
    // so its "N linked" badges don't lag; it only reloads when actually open.
    window.dispatchEvent(new CustomEvent('baseline:categories-changed'));
  };

  // Clicking the donut center cycles the display unit (min → hr → day). The hook
  // persists it and broadcasts to every other page (History, Metrics, …).
  const cycleUnit = () => {
    const order = ['min', 'hr', 'day'] as const;
    setUnit(order[(order.indexOf(unit) + 1) % order.length]);
  };

  async function deleteEntry(id: string) {
    // Optimistic: drop the row immediately instead of waiting on the DELETE plus
    // refreshAll()'s multi-fetch reload. Roll back on failure.
    const prev = entries;
    setEntries((e) => (e ? { ...e, data: e.data.filter((x) => x.id !== id) } : e));
    try {
      await apiFetch(`/v1/time-entries/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
      setEntries(prev);
    }
    refreshAll();
  }

  async function recolor(category: string, color: string) {
    // Optimistic: recolor the donut/legend immediately; loadColors() reconciles.
    const prev = colors;
    setColors((c) => ({ ...c, [category]: color }));
    try {
      await apiFetch('/v1/category-colors', {
        method: 'PUT',
        body: JSON.stringify({ category, color }),
      });
    } catch (err) {
      console.error(err);
      setColors(prev);
    }
    loadColors();
    // Tell the co-mounted categories panel to refresh its swatches — it caches its
    // own category list and would otherwise show the old color until reopened.
    window.dispatchEvent(new CustomEvent('baseline:categories-changed'));
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
  // Allocation-section label from the real bucket count: 7 for a week, the month's
  // actual length (e.g. July → "Next 31 days"), 12 for a year. Falls back to the
  // static label until data loads.
  const allocationLabel =
    barRows.length > 0 ? `Next ${barRows.length} ${isYear ? 'months' : 'days'}` : ALLOCATION_LABEL[period];
  // y-axis ceiling: 24h for day views, a full 31-day month (744h) for the year.
  const yMax = isYear ? DAY_HOURS * 31 : DAY_HOURS;
  // Key of the bucket containing today, used to emphasize today's bar. For the
  // year view (monthly buckets) that's the 1st of the current month.
  // Today in the user's timezone (matches the server's local-day bucket keys).
  const todayLocal = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // YYYY-MM-DD
  const todayKey = granularity === 'month' ? `${todayLocal.slice(0, 7)}-01` : todayLocal;

  // A running/paused timer shows as a live "pending" block that accumulates on
  // today's bar and calendar. Only meaningful on the current period (offset 0).
  // Raw (unrounded) so the figures step at the display unit's precision (the formatter
  // rounds). Pre-rounding to 0.001 h would force coarse 0.06-minute jumps.
  const pendingHours = activeTimer ? elapsedMs(activeTimer) / 3_600_000 : 0;
  const pending =
    offset === 0 && activeTimer && pendingHours > 0
      ? { date: todayLocal, category: activeTimer.category, hours: pendingHours, running: activeTimer.startedAt !== null }
      : null;

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

  // Every category the user has touched or created, with a distinct color (overrides
  // win). Keys of `colors` are the registry — they include categories created in the
  // manage-categories modal that aren't used yet.
  const allCategories = [
    ...new Set([
      ...categories,
      ...(entries?.categories ?? []),
      ...(budget?.categories.map((c) => c.category) ?? []),
      ...Object.keys(colors),
    ]),
  ].sort();
  const colorMap = buildColorMap(allCategories, colors);
  const colorOf = (c: string) => colorMap[c] ?? colorForCategory(c, colors);

  // Hold the charts/entries until the color overrides and the full category set are
  // loaded, so the first paint uses the final colors (no split-second recolor).
  const ready = colorsReady && budget !== null && daily !== null && entries !== null;

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const tabClass = (p: Panel) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      panel === p
        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
        : 'border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
    }`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{periodRangeLabel(period, tz, offset)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <PeriodSelector
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setOffset(0);
            }}
          />
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
            <button onClick={() => togglePanel('categories')} className={tabClass('categories')}>
              Categories
            </button>
          </div>
        </div>
      </div>

      <div className="mb-2">
        <PeriodNav offset={offset} onChange={setOffset} />
      </div>

      <FocusTimerBar onLogged={refreshAll} />

      {editing !== null && (
        <Modal onClose={() => setEditing(null)}>
          <AddTimeEntryForm
            entry={editing === 'new' ? null : editing}
            knownCategories={allCategories}
            tz={tz}
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

      {panel === 'categories' && (
        <div className="mb-6">
          <ManageCategoriesModal
            onChange={() => {
              loadColors();
              refreshAll();
            }}
          />
        </div>
      )}

      {panel === 'recurring' && (
        <div className="mb-6">
          <RecurringAllocations knownCategories={allCategories} colorOf={colorOf} onChange={refreshAll} />
        </div>
      )}

      {/* Budget donut for the selected period */}
      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {PERIOD_LABEL[period]}
          </p>
          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={hideRecurring}
              onClick={() => setHideRecurring(!hideRecurring)}
              title="Hide recurring routines to focus on free time"
              className="flex items-center gap-2"
            >
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Hide recurring</span>
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  hideRecurring ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                    hideRecurring ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
        {ready && budget ? (
          <BudgetDonut
            categories={budget.categories}
            trackedHours={budget.tracked_hours}
            freeHours={budget.free_hours}
            budget={budget.budget}
            colorOf={colorOf}
            onRecolor={recolor}
            recurringCategories={recurringCats}
            freeFocus={hideRecurring}
            unit={unit}
            onCycleUnit={cycleUnit}
            pending={pending}
          />
        ) : (
          <div className="h-[200px] bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
        )}
      </div>

      {/* Allocation over the period — bar chart or calendar grid */}
      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {allocationLabel}
          </p>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            {(['bars', 'calendar'] as const).map((v) => (
              <button
                key={v}
                // Toggle to the other view on any click — so clicking the active icon
                // again flips back to the other side. Persisted per-user across devices.
                onClick={() => setAllocView(allocView === 'bars' ? 'calendar' : 'bars')}
                aria-label={v === 'bars' ? 'Bar view' : 'Calendar view'}
                aria-pressed={allocView === v}
                className={`p-1.5 rounded-md transition-colors ${
                  allocView === v
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                {v === 'bars' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 20V10M12 20V4M19 20v-6" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        {ready && daily ? (
          allocView === 'calendar' ? (
            <CalendarAllocation data={barRows} categories={stackCategories} colorOf={colorOf} granularity={granularity} recurringCategories={recurringCats} freeFocus={hideRecurring} todayISO={todayKey} entries={entries?.data ?? []} tz={tz} pending={pending} unit={unit} />
          ) : (
            <DailyAllocationBars data={barRows} categories={stackCategories} colorOf={colorOf} todayISO={todayKey} yMax={yMax} recurringCategories={recurringCats} freeFocus={hideRecurring} pending={pending} unit={unit} />
          )
        ) : (
          <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
        )}
      </div>

      {/* Entries list */}
      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">
          Entries {PERIOD_LABEL[period].toLowerCase()}
        </p>
        {!ready || !entries ? (
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
                <span className="text-xs text-neutral-400 dark:text-neutral-500 w-16">{fmtDate(e.occurred_at, tz)}</span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400 flex-1 truncate">{e.note}</span>
                {e.timed && (
                  <span className="hidden sm:block text-xs text-neutral-400 dark:text-neutral-500 tabular-nums flex-shrink-0">
                    {timeRange(e.occurred_at, e.hours, tz)}
                  </span>
                )}
                {e.task_id && (
                  <Link
                    href={`/goals?task=${e.task_id}`}
                    onClick={(ev) => ev.stopPropagation()}
                    aria-label="Go to task"
                    title="Open this task in Goals"
                    className="flex-shrink-0 text-neutral-300 dark:text-neutral-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 5h5m0 0v5m0-5L9.5 14.5M18 13v5a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h5" />
                    </svg>
                  </Link>
                )}
                <span className="text-sm font-medium text-neutral-900 dark:text-white tabular-nums">{fmtDuration(e.hours, unit)}</span>
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
