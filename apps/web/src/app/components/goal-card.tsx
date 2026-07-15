'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { goalColor } from '../../lib/goal-colors';
import { GoalColorPicker } from './goal-color-picker';
import { GoalDetail } from './goal-detail';
import { Modal } from './modal';
import { dueMeta, DUE_TONE_CLASS } from '../../lib/due-date';

export interface Goal {
  id: string;
  title: string;
  category: string | null;
  color: string | null;
  due_at: string | null;
  done: boolean;
  completed_at: string | null;
  task_total: number;
  task_done: number;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function GoalCard({
  goal,
  onChange,
  countdown = false,
  drag,
}: {
  goal: Goal;
  onChange: () => void;
  countdown?: boolean;
  drag?: { onStart: (e: React.DragEvent) => void; onEnd: (e: React.DragEvent) => void };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.title);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const color = goalColor(goal.color, goal.id);
  // Show the target-date badge while the goal is open; once done, the "Completed" line takes over.
  const due = goal.done ? null : dueMeta(goal.due_at, false, countdown);

  function toggleExpand() {
    setEverOpened(true);
    setExpanded((v) => !v);
  }

  async function setColor(c: string) {
    await apiFetch(`/v1/goals/${goal.id}`, { method: 'PATCH', body: JSON.stringify({ color: c }) }).catch(console.error);
    onChange();
  }

  async function toggle() {
    await apiFetch(`/v1/goals/${goal.id}`, { method: 'PATCH', body: JSON.stringify({ done: !goal.done }) }).catch(console.error);
    onChange();
  }
  async function remove() {
    await apiFetch(`/v1/goals/${goal.id}`, { method: 'DELETE' }).catch(console.error);
    onChange();
  }

  function startEdit() {
    setDraft(goal.title);
    setEditing(true);
  }
  async function saveEdit() {
    setEditing(false);
    const t = draft.trim();
    if (!t || t === goal.title) return;
    await apiFetch(`/v1/goals/${goal.id}`, { method: 'PATCH', body: JSON.stringify({ title: t }) }).catch(console.error);
    onChange();
  }

  return (
    <div data-goal-card className="group rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div
        className={`flex items-center gap-3 p-4 select-none ${editing ? '' : 'cursor-pointer'}`}
        onClick={editing ? undefined : toggleExpand}
        draggable={!!drag && !editing}
        onDragStart={drag?.onStart}
        onDragEnd={drag?.onEnd}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label={goal.done ? 'Mark as not done' : 'Mark as done'}
          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
            goal.done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-emerald-400'
          }`}
        >
          {goal.done && (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full text-sm rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 -my-1 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          ) : (
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 min-w-0">
              <span
                className={`order-2 md:order-1 min-w-0 block text-sm break-words md:truncate ${
                  goal.done ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-white'
                }`}
              >
                {goal.title}
              </span>
              {(goal.category || due) && (
                <div className="order-1 md:order-2 flex flex-wrap items-center gap-1.5">
                  {goal.category && (
                    <span
                      className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                      title="Time on this goal rolls up to this category"
                    >
                      {goal.category}
                    </span>
                  )}
                  {due && (
                    <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DUE_TONE_CLASS[due.tone]}`} title="Target date">
                      {due.label}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {goal.done && goal.completed_at && !editing && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Completed {fmtDate(goal.completed_at)}</p>
          )}
        </div>

        {!editing && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-2 flex-shrink-0 transition-opacity ${
              pickerOpen ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
            }`}
          >
            <GoalColorPicker current={color} onPick={setColor} onOpenChange={setPickerOpen} />
            <button
              onClick={startEdit}
              aria-label="Edit goal"
              className="text-neutral-300 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => setConfirming(true)}
              aria-label="Delete goal"
              className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {!editing && (
          <svg
            className={`w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Slide-open detail */}
      <div className={`grid transition-all duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {everOpened && <GoalDetail goalId={goal.id} countdown={countdown} initialCategory={goal.category} initialDue={goal.due_at} />}
        </div>
      </div>

      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-6">
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">Delete goal?</h2>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              “{goal.title}” will be permanently deleted. Tasks tagged to it will become uncategorized. This can’t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
