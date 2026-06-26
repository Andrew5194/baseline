'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { CompletionHeatmap, type HeatmapCell } from './completion-heatmap';
import { RecurringTodos } from './recurring-todos';
import { TaskGoalTag } from './task-goal-tag';
import { useTimezone } from '../../lib/use-timezone';
import { goalColor } from '../../lib/goal-colors';

interface Todo {
  id: string;
  title: string;
  done: boolean;
  date: string;
  recurring: boolean;
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
}
interface GoalOpt {
  id: string;
  title: string;
  color: string;
}
interface RecurringDef {
  id: string;
  title: string;
  days_mask: number;
  since: string;
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
}
interface Completion {
  recurring_todo_id: string;
  date: string;
}
interface DayItem {
  id: string;
  title: string;
  done: boolean;
  recurring: boolean;
  goalId?: string | null;
  goalTitle?: string | null;
  goalColor?: string | null;
}

const weekdayOf = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

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
      apiFetch<{ data: Array<{ id: string; title: string; color: string | null; done: boolean }> }>('/v1/goals')
        .then((r) =>
          setGoalsList(r.data.filter((g) => !g.done).map((g) => ({ id: g.id, title: g.title, color: goalColor(g.color, g.id) }))),
        )
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
    loadGoals();
    const onGoals = () => loadGoals();
    window.addEventListener('baseline:goals-changed', onGoals);
    return () => window.removeEventListener('baseline:goals-changed', onGoals);
  }, [load, loadGoals]);

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

  async function tagGoal(id: string, goalId: string | null) {
    await apiFetch(`/v1/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ goal_id: goalId }) }).catch(console.error);
    notifyGoals();
    load();
  }

  async function tagRecurringGoal(id: string, goalId: string | null) {
    await apiFetch(`/v1/recurring-todos/${id}`, { method: 'PATCH', body: JSON.stringify({ goal_id: goalId }) }).catch(console.error);
    notifyGoals();
    load();
  }

  async function remove(id: string) {
    setTodos((ts) => ts?.filter((x) => x.id !== id) ?? null);
    await apiFetch(`/v1/todos/${id}`, { method: 'DELETE' }).catch(console.error);
    notifyGoals();
    load();
  }

  // The tasks scheduled for `day`: recurring tasks active that weekday + one-offs.
  const wd = weekdayOf(day);
  const dayItems: DayItem[] = [
    ...recurring
      .filter((r) => (r.days_mask & (1 << wd)) !== 0 && r.since <= day)
      .map((r) => ({
        id: r.id,
        title: r.title,
        done: completions.some((c) => c.recurring_todo_id === r.id && c.date === day),
        recurring: true,
        goalId: r.goal_id,
        goalTitle: r.goal_title,
        goalColor: r.goal_id ? goalColor(r.goal_color, r.goal_id) : null,
      })),
    ...(todos ?? [])
      .filter((t) => t.date === day)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        recurring: false,
        goalId: t.goal_id,
        goalTitle: t.goal_title,
        goalColor: t.goal_id ? goalColor(t.goal_color, t.goal_id) : null,
      })),
  ].sort((a, b) => Number(a.done) - Number(b.done));
  const dayCompleted = dayItems.filter((t) => t.done).length;

  const hasData = todos !== null && (todos.length > 0 || recurring.length > 0);

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">To-do</h2>
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

      {showRecurring && <RecurringTodos goals={goalsList} onChange={load} />}

      {hasData && <CompletionHeatmap cells={heatmap} onSelectDay={setSelectedDay} selected={day} />}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Day header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {fullDayLabel(day)}
            {dayItems.length > 0 && (
              <span className="ml-2 text-xs font-normal text-neutral-400 dark:text-neutral-500">{dayCompleted} / {dayItems.length} done</span>
            )}
          </p>
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
              <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
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
                <span
                  className={`flex-1 text-sm truncate ${
                    t.done ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {t.title}
                </span>
                {t.recurring ? (
                  <>
                    <TaskGoalTag
                      goals={goalsList}
                      value={t.goalId ?? null}
                      goalTitle={t.goalTitle ?? null}
                      goalColor={t.goalColor ?? null}
                      onChange={(gid) => tagRecurringGoal(t.id, gid)}
                    />
                    <span className="text-neutral-300 dark:text-neutral-600 text-xs flex-shrink-0" title="Recurring task">↻</span>
                  </>
                ) : (
                  <>
                    <TaskGoalTag
                      goals={goalsList}
                      value={t.goalId ?? null}
                      goalTitle={t.goalTitle ?? null}
                      goalColor={t.goalColor ?? null}
                      onChange={(gid) => tagGoal(t.id, gid)}
                    />
                    <button
                      onClick={() => remove(t.id)}
                      aria-label="Delete task"
                      className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none flex-shrink-0"
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
