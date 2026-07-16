'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { TaskGoalTag } from './task-goal-tag';

interface GoalOpt {
  id: string;
  title: string;
  color: string;
  category: string | null;
}

interface RecurringTodo {
  id: string;
  title: string;
  days_mask: number;
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
  category: string | null;
}

type TagSel = { goalId: string | null; category: string | null };

const ALL_DAYS = 127;
const WEEKDAYS = 0b0111110; // Mon–Fri
const WEEKENDS = 0b1000001; // Sun + Sat
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeDays(mask: number): string {
  if (mask === ALL_DAYS) return 'Every day';
  if (mask === WEEKDAYS) return 'Weekdays';
  if (mask === WEEKENDS) return 'Weekends';
  const days = DAY_NAMES.filter((_, i) => (mask & (1 << i)) !== 0);
  return days.length ? days.join(', ') : 'Never';
}

export function RecurringTodos({
  goals,
  categories,
  categoryColorOf,
  onChange,
}: {
  goals: GoalOpt[];
  categories: string[];
  categoryColorOf?: (cat: string) => string;
  onChange: () => void;
}) {
  const [items, setItems] = useState<RecurringTodo[]>([]);
  const [title, setTitle] = useState('');
  const [daysMask, setDaysMask] = useState(ALL_DAYS);
  const [label, setLabel] = useState<TagSel>({ goalId: null, category: null });
  const [error, setError] = useState('');

  const load = useCallback(
    () => apiFetch<{ data: RecurringTodo[] }>('/v1/recurring-todos').then((r) => setItems(r.data ?? [])).catch(console.error),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('Enter a task');
    if (daysMask === 0) return setError('Pick at least one day');
    setError('');
    await apiFetch('/v1/recurring-todos', {
      method: 'POST',
      body: JSON.stringify({ title: t, days_mask: daysMask, goal_id: label.goalId, category: label.category }),
    }).catch(console.error);
    setTitle('');
    setDaysMask(ALL_DAYS);
    setLabel({ goalId: null, category: null });
    load();
    onChange();
  }

  async function tag(id: string, sel: TagSel) {
    const goal = sel.goalId ? goals.find((g) => g.id === sel.goalId) ?? null : null;
    // Optimistic: update the chip immediately (goal/category are mutually
    // exclusive). Roll back on failure; load()/onChange() reconcile.
    const prev = items;
    setItems((its) =>
      its.map((i) =>
        i.id === id
          ? { ...i, goal_id: sel.goalId, goal_title: goal?.title ?? null, goal_color: goal?.color ?? null, category: sel.category }
          : i,
      ),
    );
    try {
      await apiFetch(`/v1/recurring-todos/${id}`, { method: 'PATCH', body: JSON.stringify({ goal_id: sel.goalId, category: sel.category }) });
    } catch (e) {
      console.error(e);
      setItems(prev);
    }
    load();
    onChange();
  }

  async function remove(id: string) {
    // Optimistic: drop the row immediately. Roll back on failure.
    const prev = items;
    setItems((its) => its.filter((i) => i.id !== id));
    try {
      await apiFetch(`/v1/recurring-todos/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
      setItems(prev);
    }
    load();
    onChange();
  }

  const newGoal = goals.find((g) => g.id === label.goalId) ?? null;

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4 mb-4">
      <div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">Recurring tasks</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Tasks that appear on the days you choose, ready to check off each day.
        </p>
      </div>

      {items.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2 group">
              <span className="text-neutral-400 dark:text-neutral-500 flex-shrink-0">↻</span>
              <span className="text-sm text-neutral-900 dark:text-white flex-1 truncate">{it.title}</span>
              <TaskGoalTag
                goals={goals}
                categories={categories}
                categoryColorOf={categoryColorOf}
                value={it.goal_id}
                goalTitle={it.goal_title}
                goalColor={it.goal_color}
                category={it.category}
                onChange={(sel) => tag(it.id, sel)}
              />
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{describeDays(it.days_mask)}</span>
              <button
                onClick={() => remove(it.id)}
                aria-label="Delete recurring task"
                className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="space-y-3 pt-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Daily stand-up"
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
        />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Days</span>
            <div className="flex gap-1.5 text-[11px]">
              <button type="button" onClick={() => setDaysMask(ALL_DAYS)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">Every day</button>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <button type="button" onClick={() => setDaysMask(WEEKDAYS)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">Weekdays</button>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <button type="button" onClick={() => setDaysMask(WEEKENDS)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">Weekends</button>
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Label</span>
          <TaskGoalTag
            goals={goals}
            categories={categories}
            categoryColorOf={categoryColorOf}
            value={label.goalId}
            goalTitle={newGoal?.title ?? null}
            goalColor={newGoal?.color ?? null}
            category={label.category}
            onChange={setLabel}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
        >
          Add recurring
        </button>
      </form>
    </div>
  );
}
