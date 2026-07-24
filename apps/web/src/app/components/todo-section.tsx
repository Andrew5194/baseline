'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { CompletionHeatmap, type HeatmapCell } from './completion-heatmap';
import { RecurringTodos } from './recurring-todos';
import { TaskGoalTag } from './task-goal-tag';
import { TaskTimerPanel } from './task-timer-panel';
import { ActionsMenu } from './actions-menu';
import { prefetchTaskEntries } from '../../lib/task-entries';
import { useFocusTimer, updateTimer, startTimer } from '../../lib/focus-timer';
import { useTimeUnit } from '../../lib/use-time-unit';
import { DayJournal } from './day-journal';
import { Modal } from './modal';
import { useTimezone } from '../../lib/use-timezone';
import { goalColor } from '../../lib/goal-colors';
import { PRESET_CATEGORIES, buildColorMap, colorForCategory } from '../../lib/categories';

interface Todo {
  id: string;
  title: string;
  done: boolean;
  date: string;
  completed_at: string | null;
  recurring: boolean;
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
  goal_category: string | null;
  category: string | null;
  sessions: number; // count of logged time sessions linked to this task
}
interface GoalOpt {
  id: string;
  title: string;
  color: string;
  category: string | null;
}
interface RecurringDef {
  id: string;
  title: string;
  days_mask: number;
  since: string;
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
  goal_category: string | null;
  category: string | null;
}
interface Completion {
  recurring_todo_id: string;
  date: string;
  completed_at: string;
}
interface DayItem {
  id: string;
  title: string;
  done: boolean;
  completedAt?: string | null;
  recurring: boolean;
  goalId?: string | null;
  goalTitle?: string | null;
  goalColor?: string | null;
  goalCategory?: string | null;
  category?: string | null;
  date?: string; // the scheduled day (one-off tasks only)
  sessions?: number; // linked time sessions (one-off tasks only)
}

const weekdayOf = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

function completedTooltip(iso: string | null | undefined, tz: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  return `Completed ${date} at ${time}`;
}

function fullDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const Check = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

// A small dialog to reschedule a one-off task to another day.
function MoveTaskModal({
  item,
  onClose,
  onMove,
}: {
  item: DayItem;
  onClose: () => void;
  onMove: (item: DayItem, date: string) => void;
}) {
  const [date, setDate] = useState(item.date ?? '');
  return (
    <Modal onClose={onClose}>
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-6">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">Move task</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 truncate">“{item.title}”</p>
        <label className="block mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          New date
        </label>
        <input
          type="date"
          autoFocus
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onMove(item, date)}
            disabled={!date || date === item.date}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Move
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TodoSection({ countdown = false }: { countdown?: boolean } = {}) {
  const tz = useTimezone();
  const [unit] = useTimeUnit();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [recurring, setRecurring] = useState<RecurringDef[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [goalsList, setGoalsList] = useState<GoalOpt[]>([]);
  const [title, setTitle] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [timerTask, setTimerTask] = useState<string | null>(null);
  const [movingTask, setMovingTask] = useState<DayItem | null>(null);
  const [knownCats, setKnownCats] = useState<string[]>([]);
  const [catColors, setCatColors] = useState<Record<string, string>>({});
  // A task id from a `?task=` deep link (e.g. the "go to task" link on a time entry).
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  // Which month the completion heatmap shows — 0 = current, 1 = last month, …
  const [heatmapOffset, setHeatmapOffset] = useState(0);
  const activeTimer = useFocusTimer();

  const load = useCallback(
    () =>
      apiFetch<{ data: Todo[]; heatmap: HeatmapCell[]; recurring: RecurringDef[]; completions: Completion[] }>(
        `/v1/todos?month_offset=${heatmapOffset}`,
      )
        .then((r) => {
          setTodos(r.data);
          setHeatmap(r.heatmap ?? []);
          setRecurring(r.recurring ?? []);
          setCompletions(r.completions ?? []);
        })
        .catch(console.error),
    [heatmapOffset],
  );
  const loadGoals = useCallback(
    () =>
      apiFetch<{ data: Array<{ id: string; title: string; color: string | null; category: string | null; done: boolean }> }>('/v1/goals')
        .then((r) =>
          setGoalsList(
            r.data.filter((g) => !g.done).map((g) => ({ id: g.id, title: g.title, color: goalColor(g.color, g.id), category: g.category })),
          ),
        )
        .catch(() => {}),
    [],
  );
  const loadCategories = useCallback(
    () =>
      apiFetch<{ categories: Array<{ name: string }> }>('/v1/categories')
        .then((r) => setKnownCats((r.categories ?? []).map((c) => c.name)))
        .catch(() => {}),
    [],
  );
  // The user's category color overrides — so category tags use the same colors as
  // the donut/registry, not a stale palette guess.
  const loadCatColors = useCallback(
    () =>
      apiFetch<{ colors: Record<string, string> }>('/v1/category-colors')
        .then((r) => setCatColors(r.colors ?? {}))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
    loadGoals();
    loadCategories();
    loadCatColors();
    // A goal changed (created, completed, tagged, reordered…): the goal options for
    // task tags may have changed, and a goal/task tag can introduce a new category —
    // but category COLORS don't change on a goal edit, so don't refetch them here.
    const onGoals = () => {
      loadGoals();
      loadCategories();
    };
    // A category's list or color actually changed (created/deleted/renamed/recolored):
    // refresh the category set and its color overrides. TodoSection didn't react to
    // this before, so recolors now update its task-tag colors live.
    const onCategories = () => {
      loadCategories();
      loadCatColors();
    };
    // A task completed elsewhere (e.g. the post-timer toast) should refresh the list.
    const onTodos = () => load();
    window.addEventListener('baseline:goals-changed', onGoals);
    window.addEventListener('baseline:categories-changed', onCategories);
    window.addEventListener('baseline:todos-changed', onTodos);
    return () => {
      window.removeEventListener('baseline:goals-changed', onGoals);
      window.removeEventListener('baseline:categories-changed', onCategories);
      window.removeEventListener('baseline:todos-changed', onTodos);
    };
  }, [load, loadGoals, loadCategories, loadCatColors]);

  // If a task's timer is running (e.g. started from the Overview), reveal that
  // task's dropdown automatically when returning to this page.
  useEffect(() => {
    if (activeTimer?.taskId) setTimerTask(activeTimer.taskId);
  }, [activeTimer?.taskId]);

  // Pick up a `?task=` deep link (the "go to task" link on a time entry).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('task');
    if (t) setPendingTask(t);
  }, []);
  // Once tasks load, jump to the linked task's day and open its panel.
  useEffect(() => {
    if (!pendingTask || todos === null) return;
    const oneOff = todos.find((x) => x.id === pendingTask);
    if (oneOff) setSelectedDay(oneOff.date);
    setTimerTask(pendingTask);
    setPendingTask(null);
  }, [pendingTask, todos]);

  // Notify the Goals page so its tagged-task counts refresh.
  const notifyGoals = () => window.dispatchEvent(new CustomEvent('baseline:goals-changed'));

  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = selectedDay ?? todayKey;
  const isToday = day === todayKey;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle('');
    await apiFetch('/v1/todos', { method: 'POST', body: JSON.stringify({ title: t, date: day }) }).catch(console.error);
    load();
  }

  function startEdit(item: DayItem) {
    setEditingId(item.id);
    setEditDraft(item.title);
  }
  async function saveEdit(item: DayItem) {
    setEditingId(null);
    const t = editDraft.trim();
    if (!t || t === item.title) return;
    const path = item.recurring ? `/v1/recurring-todos/${item.id}` : `/v1/todos/${item.id}`;
    // Optimistic: show the new title immediately instead of reverting until the
    // PATCH + reload land. Roll back on failure.
    const prevTodos = todos;
    const prevRecurring = recurring;
    if (item.recurring) {
      setRecurring((rs) => rs.map((r) => (r.id === item.id ? { ...r, title: t } : r)));
    } else {
      setTodos((ts) => ts?.map((x) => (x.id === item.id ? { ...x, title: t } : x)) ?? null);
    }
    try {
      await apiFetch(path, { method: 'PATCH', body: JSON.stringify({ title: t }) });
    } catch (e) {
      console.error(e);
      setTodos(prevTodos);
      setRecurring(prevRecurring);
    }
    if (!item.recurring) notifyGoals();
    load();
  }

  async function toggle(item: DayItem) {
    const willBeDone = !item.done;
    const nowIso = new Date().toISOString();

    // Optimistic update: flip the checkbox in local state immediately so the UI
    // responds instantly, rather than waiting on the mutation + a full reload (two
    // sequential API round-trips). The mutation runs in the background; on failure
    // we roll back. `load()` at the end reconciles derived data (heatmap, goal
    // counts) from the server but no longer gates the visual change.
    if (item.recurring) {
      // "Done" for a recurring task = a completion row exists for (id, day).
      setCompletions((cs) => {
        const without = cs.filter((c) => !(c.recurring_todo_id === item.id && c.date === day));
        return willBeDone ? [...without, { recurring_todo_id: item.id, date: day, completed_at: nowIso }] : without;
      });
      try {
        await apiFetch(`/v1/recurring-todos/${item.id}/complete`, {
          method: 'POST',
          body: JSON.stringify({ done: willBeDone, date: day }),
        });
      } catch (e) {
        console.error(e);
        // Roll back to the pre-click state.
        setCompletions((cs) => {
          const without = cs.filter((c) => !(c.recurring_todo_id === item.id && c.date === day));
          return item.done ? [...without, { recurring_todo_id: item.id, date: day, completed_at: item.completedAt ?? nowIso }] : without;
        });
      }
    } else {
      setTodos((ts) => ts?.map((t) => (t.id === item.id ? { ...t, done: willBeDone, completed_at: willBeDone ? nowIso : null } : t)) ?? null);
      try {
        await apiFetch(`/v1/todos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ done: willBeDone }) });
        notifyGoals();
      } catch (e) {
        console.error(e);
        setTodos((ts) => ts?.map((t) => (t.id === item.id ? { ...t, done: item.done, completed_at: item.completedAt ?? null } : t)) ?? null);
      }
    }
    // Background reconcile (heatmap + goal counts). No longer blocks the checkbox.
    load();
  }

  // Tag a task to either a goal or a category (mutually exclusive; the API clears
  // the other). Works for one-off and recurring tasks.
  async function tagItem(item: DayItem, sel: { goalId: string | null; category: string | null }) {
    const path = item.recurring ? `/v1/recurring-todos/${item.id}` : `/v1/todos/${item.id}`;
    const goal = sel.goalId ? goalsList.find((g) => g.id === sel.goalId) ?? null : null;
    // Optimistic: apply the tag to local state so the chip updates instantly (goal
    // and category are mutually exclusive — the API clears the other). Roll back on
    // failure; load() reconciles server truth in the background.
    const prevTodos = todos;
    const prevRecurring = recurring;
    const patch = {
      goal_id: sel.goalId,
      goal_title: goal?.title ?? null,
      goal_color: goal?.color ?? null,
      goal_category: goal?.category ?? null,
      category: sel.category,
    };
    if (item.recurring) {
      setRecurring((rs) => rs.map((r) => (r.id === item.id ? { ...r, ...patch } : r)));
    } else {
      setTodos((ts) => ts?.map((t) => (t.id === item.id ? { ...t, ...patch } : t)) ?? null);
    }
    // Keep a running timer for this task in sync with its new category (a goal's
    // category wins, else the directly-tagged one, else Uncategorized).
    if (activeTimer?.taskId === item.id) {
      updateTimer({ category: goal?.category ?? sel.category ?? 'Uncategorized' });
    }
    try {
      await apiFetch(path, { method: 'PATCH', body: JSON.stringify({ goal_id: sel.goalId, category: sel.category }) });
    } catch (e) {
      console.error(e);
      setTodos(prevTodos);
      setRecurring(prevRecurring);
    }
    notifyGoals();
    load();
  }

  // Delete a task. For a recurring occurrence this removes the underlying recurring
  // rule (so it stops appearing on every day), mirroring the recurring-tasks card.
  async function removeItem(item: { id: string; recurring: boolean }) {
    if (item.recurring) {
      setRecurring((rs) => rs.filter((r) => r.id !== item.id));
      await apiFetch(`/v1/recurring-todos/${item.id}`, { method: 'DELETE' }).catch(console.error);
    } else {
      setTodos((ts) => ts?.filter((x) => x.id !== item.id) ?? null);
      await apiFetch(`/v1/todos/${item.id}`, { method: 'DELETE' }).catch(console.error);
    }
    notifyGoals();
    load();
  }

  // Reschedule a one-off task to another day. Optimistic: update its date so it
  // leaves the current day-bucket immediately; load() reconciles + refreshes the
  // heatmap. Only offered for tasks with no linked time sessions.
  async function moveTask(item: DayItem, newDate: string) {
    setMovingTask(null);
    if (!newDate || newDate === item.date) return;
    setTodos((ts) => ts?.map((t) => (t.id === item.id ? { ...t, date: newDate } : t)) ?? null);
    await apiFetch(`/v1/todos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ date: newDate }) }).catch(console.error);
    notifyGoals();
    load();
  }

  // Categories offered in the label picker: presets + categories on goals + any the
  // user has created/used (from the canonical /v1/categories list).
  const categories = [
    ...new Set([...PRESET_CATEGORIES, ...goalsList.map((g) => g.category).filter((c): c is string => !!c), ...knownCats]),
  ];
  // Resolve a category to its registry color (override → preset → stable palette),
  // matching the donut. Goals keep their own color (carried on each goal option).
  const categoryColorMap = buildColorMap(categories, catColors);
  const categoryColorOf = (c: string) => categoryColorMap[c] ?? colorForCategory(c, catColors);

  // The tasks scheduled for `day`: recurring tasks active that weekday + one-offs.
  const wd = weekdayOf(day);
  const dayItems: DayItem[] = [
    ...recurring
      .filter((r) => (r.days_mask & (1 << wd)) !== 0 && r.since <= day)
      .map((r) => {
        const comp = completions.find((c) => c.recurring_todo_id === r.id && c.date === day);
        return {
          id: r.id,
          title: r.title,
          done: !!comp,
          completedAt: comp?.completed_at ?? null,
          recurring: true,
          goalId: r.goal_id,
          goalTitle: r.goal_title,
          goalColor: r.goal_id ? goalColor(r.goal_color, r.goal_id) : null,
          goalCategory: r.goal_category,
          category: r.category,
        };
      }),
    ...(todos ?? [])
      .filter((t) => t.date === day)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        completedAt: t.completed_at,
        recurring: false,
        goalId: t.goal_id,
        goalTitle: t.goal_title,
        goalColor: t.goal_id ? goalColor(t.goal_color, t.goal_id) : null,
        goalCategory: t.goal_category,
        category: t.category,
        date: t.date,
        sessions: t.sessions,
      })),
  ].sort((a, b) => Number(a.done) - Number(b.done));

  // Show the heatmap as soon as the month has loaded — even with no tasks yet, so a
  // fresh account still sees the empty grid (the API always returns a full month).
  const loaded = todos !== null;

  return (
    <>
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Tasks</h2>
        <button
          onClick={() => setShowRecurring((v) => !v)}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            showRecurring
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
              : 'border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
          }`}
        >
          ↻ Recurring
        </button>
      </div>

      {showRecurring && <RecurringTodos goals={goalsList} categories={categories} categoryColorOf={categoryColorOf} onChange={load} />}

      {loaded && (
        <CompletionHeatmap
          cells={heatmap}
          onSelectDay={setSelectedDay}
          selected={day}
          countdown={countdown}
          onPrevMonth={() => setHeatmapOffset((o) => o + 1)}
          onNextMonth={() => setHeatmapOffset((o) => Math.max(0, o - 1))}
          canNextMonth={heatmapOffset > 0}
          focusStat={{ date: day, completed: dayItems.filter((t) => t.done).length, total: dayItems.length }}
        />
      )}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Day header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{fullDayLabel(day)}</p>
          {!isToday && (
            <button onClick={() => setSelectedDay(null)} className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              Today →
            </button>
          )}
        </div>

        {/* Add a task — for the selected day */}
        <form onSubmit={add} className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <span className="w-4 h-4 rounded-[5px] border border-dashed border-neutral-300 dark:border-neutral-600 flex-shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none"
          />
          {title.trim() && (
            <button type="submit" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500">
              Add
            </button>
          )}
        </form>

        {/* List */}
        {todos === null ? (
          <div className="p-4 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded shimmer" />
            ))}
          </div>
        ) : dayItems.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-400 dark:text-neutral-500 text-center">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {dayItems.map((t) => (
              <li key={t.id} className="group">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    onClick={() => toggle(t)}
                    aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                    className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                      t.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-neutral-300 dark:border-neutral-600 hover:border-emerald-400'
                    }`}
                  >
                    {t.done && <Check />}
                  </button>
                  {editingId === t.id ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => saveEdit(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(t);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 text-sm rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 -my-1 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(t)}
                      title={t.done ? completedTooltip(t.completedAt, tz) ?? 'Completed' : undefined}
                      className={`flex-1 text-sm text-left truncate ${
                        t.done ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {t.title}
                    </button>
                  )}
                  <TaskGoalTag
                    goals={goalsList}
                    categories={categories}
                    categoryColorOf={categoryColorOf}
                    value={t.goalId ?? null}
                    goalTitle={t.goalTitle ?? null}
                    goalColor={t.goalColor ?? null}
                    category={t.category ?? null}
                    onChange={(sel) => tagItem(t, sel)}
                  />
                  {t.recurring && (
                    <span className="text-neutral-300 dark:text-neutral-600 text-xs flex-shrink-0" title="Recurring task">↻</span>
                  )}
                  <div className="flex-shrink-0">
                    <ActionsMenu
                      label="Task actions"
                      onOpen={() => prefetchTaskEntries(t.id)}
                      items={[
                        {
                          label: 'Start timer',
                          icon: (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          ),
                          onClick: () => {
                            // Open this task's panel (only one is open at a time) and start the
                            // timer, unless another task's timer is already running (don't clobber it).
                            if (!activeTimer) startTimer(t.goalCategory ?? t.category ?? 'Uncategorized', t.title, t.id);
                            setTimerTask(t.id);
                          },
                        },
                        {
                          label: timerTask === t.id ? 'Hide time logs' : 'Show time logs',
                          icon: (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h10" />
                            </svg>
                          ),
                          onClick: () => setTimerTask(timerTask === t.id ? null : t.id),
                        },
                        // One-off tasks can be rescheduled — but only when no time has
                        // been logged against them, so time-allocation history is never
                        // shifted. Recurring tasks are weekday-based, so no "move".
                        ...(t.recurring
                          ? []
                          : [
                              {
                                label: 'Move to date',
                                disabled: (t.sessions ?? 0) > 0,
                                title:
                                  (t.sessions ?? 0) > 0
                                    ? 'This task can’t be moved because it has linked time sessions'
                                    : undefined,
                                icon: (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ),
                                onClick: () => setMovingTask(t),
                              },
                            ]),
                        {
                          label: t.recurring ? 'Delete recurring' : 'Delete task',
                          danger: true,
                          icon: (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          ),
                          onClick: () => removeItem(t),
                        },
                      ]}
                    />
                  </div>
                </div>
                {timerTask === t.id && (
                  <div className="pl-11 pr-4 pb-3">
                    <TaskTimerPanel
                      taskId={t.id}
                      title={t.title}
                      category={t.goalCategory ?? t.category ?? 'Uncategorized'}
                      color={
                        t.goalId && t.goalTitle
                          ? t.goalColor ?? '#9ca3af'
                          : t.category
                            ? categoryColorOf(t.category)
                            : '#9ca3af'
                      }
                      tz={tz}
                      unit={unit}
                      onLogged={load}
                      taskDone={t.done}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>

    <DayJournal day={day} dayLabel={fullDayLabel(day)} />

    {movingTask && <MoveTaskModal item={movingTask} onClose={() => setMovingTask(null)} onMove={moveTask} />}
    </>
  );
}
