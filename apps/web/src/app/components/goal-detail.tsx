'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { PRESET_CATEGORIES } from '../../lib/categories';

const CUSTOM = '__custom__';

interface DetailTodo {
  id: string;
  title: string;
  done: boolean;
  date: string | null;
}
interface DetailRecurring {
  id: string;
  title: string;
  days_mask: number;
}
interface GoalDetailData {
  goal: { id: string; title: string; category: string | null; color: string | null; notes: string | null; done: boolean; completed_at: string | null };
  todos: DetailTodo[];
  recurring: DetailRecurring[];
}

const ALL_DAYS = 127;
const WEEKDAYS = 0b0111110;
const WEEKENDS = 0b1000001;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeDays(mask: number): string {
  if (mask === ALL_DAYS) return 'Every day';
  if (mask === WEEKDAYS) return 'Weekdays';
  if (mask === WEEKENDS) return 'Weekends';
  const days = DAY_NAMES.filter((_, i) => (mask & (1 << i)) !== 0);
  return days.length ? days.join(', ') : 'Never';
}

function fmtDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Inline detail panel that slides open under a goal card: editable notes + the
// tasks (one-off and recurring) tagged to this goal's category.
export function GoalDetail({ goalId }: { goalId: string }) {
  const [detail, setDetail] = useState<GoalDetailData | null>(null);
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [customCat, setCustomCat] = useState('');

  const load = useCallback(
    () =>
      apiFetch<GoalDetailData>(`/v1/goals/${goalId}`)
        .then((d) => {
          setDetail(d);
          setNotes((prev) => (prev === '' ? d.goal.notes ?? '' : prev));
          setSavedNotes(d.goal.notes ?? '');
          setCat((prev) => (prev === null ? d.goal.category : prev));
        })
        .catch(console.error),
    [goalId],
  );

  async function saveCategory(value: string | null) {
    setCat(value);
    await apiFetch(`/v1/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ category: value }) }).catch(console.error);
    // Refresh the goal card chip + any rolled-up category views.
    window.dispatchEvent(new CustomEvent('baseline:goals-changed'));
  }

  function onSelectCategory(v: string) {
    if (v === CUSTOM) {
      setCustomizing(true);
      setCustomCat('');
      return;
    }
    setCustomizing(false);
    saveCategory(v || null);
  }
  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('baseline:goals-changed', onChange);
    return () => window.removeEventListener('baseline:goals-changed', onChange);
  }, [load]);

  async function saveNotes() {
    if (notes === savedNotes) return;
    setSaving(true);
    setSavedNotes(notes);
    await apiFetch(`/v1/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ notes }) }).catch(console.error);
    setSaving(false);
  }

  const totalTasks = detail ? detail.todos.length + detail.recurring.length : 0;
  // Completion is counted only over the tasks tagged to this goal (one-off tasks;
  // recurring tasks are per-day and aren't tallied here).
  const countedTasks = detail ? detail.todos.length : 0;
  const doneTasks = detail ? detail.todos.filter((t) => t.done).length : 0;

  return (
    <div className="px-4 pb-4 pt-1 space-y-4 border-t border-neutral-100 dark:border-neutral-800">
      {/* Category — time on this goal's tasks rolls up here */}
      <div className="pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Category</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Tracked time rolls up here</span>
        </div>
        {customizing ? (
          <input
            autoFocus
            value={customCat}
            onChange={(e) => setCustomCat(e.target.value)}
            onBlur={() => {
              setCustomizing(false);
              const c = customCat.trim();
              if (c) saveCategory(c);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setCustomizing(false);
            }}
            placeholder="New category name"
            className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        ) : (
          <select
            value={cat ?? ''}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          >
            <option value="">Uncategorized</option>
            {[...new Set([...PRESET_CATEGORIES, ...(cat && !PRESET_CATEGORIES.includes(cat) ? [cat] : [])])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
        )}
      </div>

      {/* Notes */}
      <div className="pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Notes</span>
          {saving && <span className="text-[10px] text-neutral-400">Saving…</span>}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add notes about this goal — the why, the plan, anything…"
          rows={3}
          className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
        />
      </div>

      {/* Attributed tasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Tasks in this category</span>
          {countedTasks > 0 && (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{doneTasks} / {countedTasks} tasks completed</span>
          )}
        </div>

        {detail === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-5 bg-neutral-100 dark:bg-neutral-800 rounded shimmer" />
            ))}
          </div>
        ) : totalTasks === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-2 text-center">
            No tasks tagged to this goal yet. Tag tasks from the to-do list to build it up.
          </p>
        ) : (
          <div className="space-y-1.5">
            {detail.todos.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 text-sm">
                <span className="w-3.5 text-center text-lg leading-none text-neutral-400 dark:text-neutral-500 flex-shrink-0" aria-hidden="true">•</span>
                <span className={`flex-1 truncate ${t.done ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-200'}`}>
                  {t.title}
                </span>
                {t.date && <span className="text-[11px] text-neutral-400 dark:text-neutral-500 flex-shrink-0">{fmtDate(t.date)}</span>}
              </div>
            ))}
            {detail.recurring.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 text-sm">
                <span className="w-3.5 text-center text-neutral-400 dark:text-neutral-500 flex-shrink-0">↻</span>
                <span className="flex-1 truncate text-neutral-800 dark:text-neutral-200">{r.title}</span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 flex-shrink-0">{describeDays(r.days_mask)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
