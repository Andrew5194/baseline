'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

export function TodoSection({
  countdown = false,
  // When provided, gates the reveal: the parent coordinates a single page-wide
  // entrance, so the section shows a skeleton until `reveal` is true, then rises.
  reveal = true,
  // Called once the first /v1/todos fetch settles (success or error), so the parent
  // knows this section is ready to reveal.
  onReady,
}: { countdown?: boolean; reveal?: boolean; onReady?: () => void } = {}) {
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
  // First-load-settled flag → reported to the parent so it can reveal the page.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (settled) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

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
  // The user's category color overrides, so tags match the donut/registry rather
  // than a stale palette guess.
  const loadCatColors = useCallback(
    () =>
      apiFetch<{ colors: Record<string, string> }>('/v1/category-colors')
        .then((r) => setCatColors(r.colors ?? {}))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    // Mark settled once the first todos fetch resolves — success OR failure — so a
    // todos error can never wedge the page waiting to reveal.
    load().finally(() => setSettled(true));
    loadGoals();
    loadCategories();
    loadCatColors();
    // A goal changed: refresh goal options and the category set (a tag can introduce a
    // new category) — but category COLORS don't change on a goal edit, so skip those.
    const onGoals = () => {
      loadGoals();
      loadCategories();
    };
    // A category changed (created/deleted/renamed/recolored): refresh the category set
    // and its color overrides so task-tag colors update live.
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

  // If a task's timer is running (e.g. started from the Overview), auto-reveal that
  // task's dropdown when returning to this page.
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
    // On touch, submitting from the on-screen keyboard leaves the input focused so the
    // keyboard stays up — and iOS then swallows the next tap (e.g. the nav hamburger) to
    // dismiss it. Blur here so the keyboard drops now. Desktop keeps focus for rapid entry.
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      (e.currentTarget as HTMLFormElement).querySelector('input')?.blur();
    }
    await apiFetch('/v1/todos', { method: 'POST', body: JSON.stringify({ title: t, date: day }) }).catch(console.error);
    load();
  }

  function startEdit(item: DayItem) {
    setEditingId(item.id);
    setEditDraft(item.title);
  }

  // Drag-reorder one-off tasks — same HTML5 mechanism as the goal cards: the row is
  // draggable, the wrapping <li> is the drop target, and dragover reorders as you cross
  // a row's midpoint. Recurring tasks stay pinned and aren't drop targets.
  const taskDragId = useRef<string | null>(null);
  function onTaskDragStart(e: React.DragEvent, id: string) {
    taskDragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Use the row as the drag image (like the goal cards' setDragImage).
    const row = (e.currentTarget as HTMLElement).closest('li');
    if (row) e.dataTransfer.setDragImage(row, 20, 20);
  }
  function onTaskDragOver(e: React.DragEvent, targetId: string, targetRecurring: boolean) {
    const fromId = taskDragId.current;
    if (!fromId) return;
    // Accept the drop everywhere a task is being dragged (like the goal cards) so the
    // browser doesn't play the "snap back to origin" reject animation.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetRecurring || fromId === targetId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const past = e.clientY - rect.top > rect.height / 2;
    setTodos((ts) => {
      if (!ts) return ts;
      const from = ts.findIndex((x) => x.id === fromId);
      const to = ts.findIndex((x) => x.id === targetId);
      if (from < 0 || to < 0) return ts;
      if ((from < to && !past) || (from > to && past)) return ts;
      const next = [...ts];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  async function persistTaskOrder() {
    taskDragId.current = null;
    // Persist the day's one-off task order (recurring are pinned, not reorderable).
    const ids = dayItems.filter((i) => !i.recurring).map((i) => i.id);
    if (ids.length) {
      await apiFetch('/v1/todos/reorder', { method: 'POST', body: JSON.stringify({ ids }) }).catch(console.error);
    }
  }
  async function saveEdit(item: DayItem) {
    setEditingId(null);
    const t = editDraft.trim();
    if (!t || t === item.title) return;
    const path = item.recurring ? `/v1/recurring-todos/${item.id}` : `/v1/todos/${item.id}`;
    // Optimistic: show the new title immediately; roll back on failure.
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

    // Optimistic: flip the checkbox in local state immediately so the UI responds
    // without waiting on the mutation + reload. Mutation runs in the background, roll
    // back on failure; the trailing load() reconciles derived data (heatmap, goal
    // counts) without gating the visual change.
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
    // Optimistic: apply the tag to local state so the chip updates instantly (goal and
    // category are mutually exclusive — the API clears the other). Roll back on failure.
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

  // Delete a task. For a recurring occurrence this removes the underlying rule (so it
  // stops appearing on every day), mirroring the recurring-tasks card.
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

  // Reschedule a one-off task. Optimistic: update its date so it leaves the current
  // day-bucket immediately; load() reconciles + refreshes the heatmap. Only for tasks
  // with no linked time sessions.
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
  const categories = useMemo(
    () => [...new Set([...PRESET_CATEGORIES, ...goalsList.map((g) => g.category).filter((c): c is string => !!c), ...knownCats])],
    [goalsList, knownCats],
  );
  // Resolve a category to its registry color (override → preset → stable palette),
  // matching the donut. Goals keep their own color (carried on each goal option).
  const categoryColorMap = useMemo(() => buildColorMap(categories, catColors), [categories, catColors]);
  const categoryColorOf = (c: string) => categoryColorMap[c] ?? colorForCategory(c, catColors);

  // The tasks scheduled for `day`: recurring tasks active that weekday + one-offs.
  // Memoized so typing in the add/edit inputs (which re-renders) doesn't rebuild it.
  const dayItems: DayItem[] = useMemo(() => {
    const wd = weekdayOf(day);
    return [
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
  }, [recurring, completions, todos, day]);

  // Show the heatmap once the month has loaded, even with no tasks, so a fresh account
  // still sees the empty grid (the API always returns a full month).
  const loaded = todos !== null;

  // Until the parent coordinates the reveal, show a skeleton that continues the goal
  // list's rhythm — the same h-16 bars — so the whole page reads as one consistent
  // column of shimmer bars (rather than a few chunky blocks) on any viewport.
  if (!reveal) {
    return (
      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-neutral-200 dark:bg-neutral-800 shimmer" />
        ))}
      </div>
    );
  }

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

      {loaded ? (
        <div className="rise" style={{ animationDelay: '40ms' }}>
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
        </div>
      ) : (
        // Reserve the heatmap's space while /v1/todos loads (mirrors its real layout)
        // so it doesn't sit empty and pop in late.
        <div className="p-5 card-modern mb-6">
          <div className="mb-4 space-y-1.5">
            <div className="h-7 w-44 rounded bg-neutral-200 dark:bg-neutral-800 shimmer" />
            <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800 shimmer" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 31 }).map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-[4px] bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        </div>
      )}

      <div className="card-modern overflow-hidden rise" style={{ animationDelay: '100ms' }}>
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
          {/* Enter (or the on-screen keyboard's return) is the primary way to add; the ↵
              glyph fades in once there's text as a discoverable, tappable affordance —
              mainly for touch, where the return key isn't obviously "add". */}
          {title.trim() && (
            <button
              type="submit"
              aria-label="Add task"
              title="Add task"
              className="grid place-items-center self-center w-6 h-6 flex-shrink-0 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-4 h-4 translate-y-[2px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="9 10 4 15 9 20" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
              </svg>
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
              <li
                key={t.id}
                className="group"
                onDragOver={(e) => onTaskDragOver(e, t.id, t.recurring)}
                onDrop={(e) => e.preventDefault()}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 select-none ${editingId === t.id ? '' : 'cursor-pointer'}`}
                  onClick={editingId === t.id ? undefined : () => setTimerTask(timerTask === t.id ? null : t.id)}
                  draggable={!t.recurring && editingId !== t.id}
                  onDragStart={t.recurring ? undefined : (e) => onTaskDragStart(e, t.id)}
                  onDragEnd={persistTaskOrder}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(t);
                    }}
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
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => saveEdit(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(t);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 text-sm rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 -my-1 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  ) : (
                    <span
                      title={t.done ? completedTooltip(t.completedAt, tz) ?? 'Completed' : undefined}
                      className={`flex-1 text-sm truncate ${
                        t.done ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {t.title}
                    </span>
                  )}
                  <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
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
                  </span>
                  {t.recurring && (
                    <span className="text-neutral-300 dark:text-neutral-600 text-xs flex-shrink-0" title="Recurring task">↻</span>
                  )}
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <ActionsMenu
                      label="Task actions"
                      onOpen={() => prefetchTaskEntries(t.id)}
                      items={[
                        {
                          label: 'Start Task',
                          icon: (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          ),
                          onClick: () => {
                            // Open this task's panel and start the timer, unless another
                            // task's timer is already running (don't clobber it).
                            if (!activeTimer) startTimer(t.goalCategory ?? t.category ?? 'Uncategorized', t.title, t.id);
                            setTimerTask(t.id);
                          },
                        },
                        {
                          label: 'Rename',
                          icon: (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          ),
                          onClick: () => startEdit(t),
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
                        // One-off tasks can be rescheduled, but only with no logged time,
                        // so allocation history is never shifted. Recurring tasks are
                        // weekday-based, so no "move".
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

    <div className="rise" style={{ animationDelay: '160ms' }}>
      <DayJournal day={day} dayLabel={fullDayLabel(day)} />
    </div>

    {movingTask && <MoveTaskModal item={movingTask} onClose={() => setMovingTask(null)} onMove={moveTask} />}
    </>
  );
}
