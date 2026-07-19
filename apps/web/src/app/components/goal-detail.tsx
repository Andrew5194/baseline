'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { PRESET_CATEGORIES } from '../../lib/categories';

const CUSTOM = '__custom__';

// How long to wait after the last keystroke before autosaving notes. Deliberately roomy
// so a slip (or an accidental clear) can be undone before it's committed.
const AUTOSAVE_MS = 2500;

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
  goal: { id: string; title: string; category: string | null; color: string | null; notes: string | null; due_at: string | null; done: boolean; completed_at: string | null };
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
export function GoalDetail({
  goalId,
  countdown = false,
  initialCategory = null,
  initialDue = null,
}: {
  goalId: string;
  countdown?: boolean;
  initialCategory?: string | null;
  initialDue?: string | null;
}) {
  const [detail, setDetail] = useState<GoalDetailData | null>(null);
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [notesError, setNotesError] = useState(false);
  // Seed category + due from the card's already-loaded data so the selects populate
  // instantly on open, instead of flashing empty until the detail fetch returns.
  const [cat, setCat] = useState<string | null>(initialCategory);
  const [due, setDue] = useState(initialDue ?? '');
  const [customizing, setCustomizing] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [known, setKnown] = useState<string[]>([]);

  // Every category the user already uses, so the picker isn't limited to presets.
  useEffect(() => {
    apiFetch<{ categories: Array<{ name: string }> }>('/v1/categories')
      .then((r) => setKnown((r.categories ?? []).map((c) => c.name)))
      .catch(() => {});
  }, []);
  // Notes are seeded once from the fetch (they're not in the goal list payload).
  // Category + due come from props, so a later reload (or an in-flight fetch that
  // resolves after an edit) can't reset them or steal the textarea's focus.
  const seeded = useRef(false);

  const load = useCallback(
    () =>
      apiFetch<GoalDetailData>(`/v1/goals/${goalId}`)
        .then((d) => {
          setDetail(d);
          if (!seeded.current) {
            setNotes(d.goal.notes ?? '');
            setSavedNotes(d.goal.notes ?? '');
            seeded.current = true;
          }
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

  async function saveDue(value: string) {
    setDue(value);
    await apiFetch(`/v1/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ due_at: value || null }) }).catch(console.error);
    // Refresh the goal card's due badge.
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

  const savingRef = useRef(false);
  const notesRef = useRef({ notes: '', savedNotes: '' });
  notesRef.current = { notes, savedNotes };

  // Only commit `savedNotes` once the request succeeds, so a failure keeps the editor
  // "dirty" and surfaces an error instead of silently dropping text. Reads the latest
  // text from a ref so the debounce timer / unmount flush never use stale content.
  async function saveNotes() {
    const { notes: n, savedNotes: s } = notesRef.current;
    if (n === s || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setNotesError(false);
    try {
      await apiFetch(`/v1/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ notes: n }) });
      setSavedNotes(n);
    } catch (e) {
      console.error(e);
      setNotesError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const notesDirty = notes !== savedNotes;

  // Debounced autosave — persist ~800ms after the last keystroke.
  useEffect(() => {
    if (!notesDirty) return;
    const t = setTimeout(saveNotes, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, notesDirty, saving]);

  // Flush a pending edit if the panel unmounts (e.g. the goal card collapses).
  useEffect(() => {
    return () => {
      saveNotes();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalTasks = detail ? detail.todos.length + detail.recurring.length : 0;
  // Completion is counted only over the tasks tagged to this goal (one-off tasks;
  // recurring tasks are per-day and aren't tallied here).
  const countedTasks = detail ? detail.todos.length : 0;
  const doneTasks = detail ? detail.todos.filter((t) => t.done).length : 0;

  return (
    <div className="px-4 pb-4 pt-1 space-y-4 border-t border-neutral-100 dark:border-neutral-800">
      {/* Category + target date, side by side */}
      <div className="grid sm:grid-cols-2 gap-3 pt-3">
        {/* Category — time on this goal's tasks rolls up here */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Category</span>
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
            <div className="relative">
              <select
                value={cat ?? ''}
                onChange={(e) => onSelectCategory(e.target.value)}
                className="w-full appearance-none text-sm pl-3 pr-9 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              >
                <option value="">Uncategorized</option>
                {[...new Set([...PRESET_CATEGORIES, ...known, ...(cat ? [cat] : [])])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={CUSTOM}>Custom…</option>
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>

        {/* Target / expiration date */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Target date</span>
            {due && (
              <button onClick={() => saveDue('')} className="text-[10px] text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400">
                Clear
              </button>
            )}
          </div>
          <input
            type="date"
            value={due}
            onChange={(e) => saveDue(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Reason */}
      <div className="pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Reason</span>
          {saving ? (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Saving…</span>
          ) : notesError ? (
            <span className="text-[10px] text-red-500">Couldn’t save</span>
          ) : notesDirty ? (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Unsaved…</span>
          ) : savedNotes ? (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Saved</span>
          ) : null}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Think about why this goal matters."
          rows={3}
          className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-emerald-500 focus:border-emerald-500 resize-none"
        />
      </div>

      {/* Attributed tasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Tasks in this category</span>
          {countedTasks > 0 && (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {countdown
                ? countedTasks - doneTasks === 0
                  ? 'All tasks done'
                  : `${countedTasks - doneTasks} task${countedTasks - doneTasks === 1 ? '' : 's'} to go`
                : `${doneTasks} / ${countedTasks} tasks completed`}
            </span>
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
