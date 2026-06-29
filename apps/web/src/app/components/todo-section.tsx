'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { CompletionHeatmap, type HeatmapCell } from './completion-heatmap';
import { RecurringTodos } from './recurring-todos';
import { TaskGoalTag } from './task-goal-tag';
import { TaskTimer } from './task-timer';
import { useFocusTimer, updateTimer } from '../../lib/focus-timer';
import { DayJournal } from './day-journal';
import { useTimezone } from '../../lib/use-timezone';
import { goalColor } from '../../lib/goal-colors';
import { PRESET_CATEGORIES } from '../../lib/categories';

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

export function TodoSection() {
  const tz = useTimezone();
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
  const [knownCats, setKnownCats] = useState<string[]>([]);
  const activeTimer = useFocusTimer();

  const load = useCallback(
    () =>
      apiFetch<{ data: Todo[]; heatmap: HeatmapCell[]; recurring: RecurringDef[]; completions: Completion[] }>('/v1/todos')
        .then((r) => {
          setTodos(r.data);
          setHeatmap(r.heatmap ?? []);
          setRecurring(r.recurring ?? []);
          setCompletions(r.completions ?? []);
        })
        .catch(console.error),
    [],
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

  useEffect(() => {
    load();
    loadGoals();
    loadCategories();
    const onGoals = () => {
      loadGoals();
      loadCategories();
    };
    window.addEventListener('baseline:goals-changed', onGoals);
    return () => window.removeEventListener('baseline:goals-changed', onGoals);
  }, [load, loadGoals, loadCategories]);

  // If a task's timer is running (e.g. started from the Overview), reveal that
  // task's dropdown automatically when returning to this page.
  useEffect(() => {
    if (activeTimer?.taskId) setTimerTask(activeTimer.taskId);
  }, [activeTimer?.taskId]);

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
    await apiFetch(path, { method: 'PATCH', body: JSON.stringify({ title: t }) }).catch(console.error);
    if (!item.recurring) notifyGoals();
    load();
  }

  async function toggle(item: DayItem) {
    if (item.recurring) {
      await apiFetch(`/v1/recurring-todos/${item.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ done: !item.done, date: day }),
      }).catch(console.error);
    } else {
      await apiFetch(`/v1/todos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ done: !item.done }) }).catch(console.error);
      notifyGoals();
    }
    load();
  }

  // Tag a task to either a goal or a category (mutually exclusive; the API clears
  // the other). Works for one-off and recurring tasks.
  async function tagItem(item: DayItem, sel: { goalId: string | null; category: string | null }) {
    const path = item.recurring ? `/v1/recurring-todos/${item.id}` : `/v1/todos/${item.id}`;
    await apiFetch(path, { method: 'PATCH', body: JSON.stringify({ goal_id: sel.goalId, category: sel.category }) }).catch(console.error);
    // Keep a running timer for this task in sync with its new category (a goal's
    // category wins, else the directly-tagged one, else Uncategorized).
    if (activeTimer?.taskId === item.id) {
      const goalCat = sel.goalId ? goalsList.find((g) => g.id === sel.goalId)?.category ?? null : null;
      updateTimer({ category: goalCat ?? sel.category ?? 'Uncategorized' });
    }
    notifyGoals();
    load();
  }

  async function remove(id: string) {
    setTodos((ts) => ts?.filter((x) => x.id !== id) ?? null);
    await apiFetch(`/v1/todos/${id}`, { method: 'DELETE' }).catch(console.error);
    notifyGoals();
    load();
  }

  // Categories offered in the label picker: presets + categories on goals + any the
  // user has created/used (from the canonical /v1/categories list).
  const categories = [
    ...new Set([...PRESET_CATEGORIES, ...goalsList.map((g) => g.category).filter((c): c is string => !!c), ...knownCats]),
  ];

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
      })),
  ].sort((a, b) => Number(a.done) - Number(b.done));

  const hasData = todos !== null && (todos.length > 0 || recurring.length > 0);

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

      {showRecurring && <RecurringTodos goals={goalsList} categories={categories} onChange={load} />}

      {hasData && <CompletionHeatmap cells={heatmap} onSelectDay={setSelectedDay} selected={day} />}

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
        <form onSubmit={add} className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <span className="w-4 h-4 rounded-[5px] border border-dashed border-neutral-300 dark:border-neutral-600 flex-shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isToday ? 'Add a task…' : `Add a task for ${fullDayLabel(day)}…`}
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
                    value={t.goalId ?? null}
                    goalTitle={t.goalTitle ?? null}
                    goalColor={t.goalColor ?? null}
                    category={t.category ?? null}
                    onChange={(sel) => tagItem(t, sel)}
                  />
                  {t.recurring ? (
                    <span className="text-neutral-300 dark:text-neutral-600 text-xs flex-shrink-0" title="Recurring task">↻</span>
                  ) : (
                    <button
                      onClick={() => remove(t.id)}
                      aria-label="Delete task"
                      className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                  <button
                    onClick={() => setTimerTask((id) => (id === t.id ? null : t.id))}
                    aria-label="Timer"
                    aria-expanded={timerTask === t.id}
                    className="flex-shrink-0 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${timerTask === t.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {timerTask === t.id && (
                  <div className="px-4 pb-3">
                    <TaskTimer taskId={t.id} title={t.title} goal={t.goalTitle} category={t.goalCategory ?? t.category ?? 'Uncategorized'} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>

    <DayJournal day={day} dayLabel={fullDayLabel(day)} />
    </>
  );
}
