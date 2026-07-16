'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../../lib/api';
import { Modal } from '../../components/modal';
import { AddGoalForm } from '../../components/add-goal-form';
import { GoalCard, type Goal } from '../../components/goal-card';
import { TodoSection } from '../../components/todo-section';

export default function Goals() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [adding, setAdding] = useState(false);
  // Count-down mode (sticky) — reframes due dates and task counts as "time/tasks left".
  // Initialise false so the server-rendered and first client render agree (no hydration
  // mismatch), then restore the saved value right after mount.
  const [countdown, setCountdown] = useState(false);
  // Completed goals collapse into a disclosure at the bottom; remember open/closed.
  const [showCompleted, setShowCompleted] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const orderRef = useRef<Goal[]>([]);

  useEffect(() => {
    try {
      if (localStorage.getItem('baseline:goals-countdown') === '1') setCountdown(true);
      if (localStorage.getItem('baseline:goals-show-completed') === '1') setShowCompleted(true);
    } catch {}
  }, []);

  function toggleCountdown() {
    setCountdown((v) => {
      const next = !v;
      try {
        localStorage.setItem('baseline:goals-countdown', next ? '1' : '0');
      } catch {}
      return next;
    });
  }

  function toggleCompleted() {
    setShowCompleted((v) => {
      const next = !v;
      try {
        localStorage.setItem('baseline:goals-show-completed', next ? '1' : '0');
      } catch {}
      return next;
    });
  }

  const load = useCallback(
    () => apiFetch<{ data: Goal[] }>('/v1/goals').then((r) => setGoals(r.data)).catch(console.error),
    [],
  );

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('baseline:goals-changed', onChange);
    return () => window.removeEventListener('baseline:goals-changed', onChange);
  }, [load]);

  useEffect(() => {
    if (goals) orderRef.current = goals;
  }, [goals]);

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const from = dragIndex.current;
    if (from === null || from === i) return;
    // Only swap once the pointer crosses the target's midpoint — keeps the reorder
    // from thrashing back and forth while hovering a single card.
    const rect = e.currentTarget.getBoundingClientRect();
    const past = e.clientY - rect.top > rect.height / 2;
    if ((from < i && !past) || (from > i && past)) return;
    // Reorder within the active goals only (completed goals live in their own
    // collapsed section and aren't draggable); keep completed appended at the end.
    setGoals((gs) => {
      if (!gs) return gs;
      const active = gs.filter((g) => !g.done);
      const done = gs.filter((g) => g.done);
      const [moved] = active.splice(from, 1);
      active.splice(i, 0, moved);
      return [...active, ...done];
    });
    dragIndex.current = i;
  }

  // Optimistically merge a partial update into a goal in local list state so its
  // card (checkbox, color, title) updates instantly; GoalCard reconciles server
  // truth via load() afterward.
  const patchGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setGoals((gs) => gs?.map((g) => (g.id === id ? { ...g, ...patch } : g)) ?? null);
  }, []);

  async function persistOrder() {
    dragIndex.current = null;
    // Only active goals carry a manual order; the reorder endpoint sets position by
    // index for the ids sent and leaves completed goals' positions untouched.
    const ids = orderRef.current.filter((g) => !g.done).map((g) => g.id);
    if (ids.length) {
      await apiFetch('/v1/goals/reorder', { method: 'POST', body: JSON.stringify({ ids }) }).catch(console.error);
    }
  }

  // Active goals keep their manual order; completed goals go into the collapsed
  // section, newest completion first.
  const active = goals?.filter((g) => !g.done) ?? [];
  const completed = (goals?.filter((g) => g.done) ?? [])
    .slice()
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Things you want to accomplish</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            role="switch"
            aria-checked={countdown}
            onClick={toggleCountdown}
            title="Show time & tasks remaining"
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap"
          >
            Count down
            <span
              className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
                countdown ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  countdown ? 'translate-x-[14px]' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium whitespace-nowrap hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            <span className="text-sm leading-none">+</span>
            New goal
          </button>
        </div>
      </div>

      {adding && (
        <Modal onClose={() => setAdding(false)}>
          <AddGoalForm onClose={() => setAdding(false)} onSuccess={load} />
        </Modal>
      )}

      {goals === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <>
          {goals.length === 0 ? (
            <div className="p-12 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No goals yet.</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Add something you want to accomplish — big or small.
              </p>
              <button
                onClick={() => setAdding(true)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
              >
                Create your first goal
              </button>
            </div>
          ) : (
            <>
              {active.length === 0 ? (
                <p className="py-8 text-sm text-neutral-400 dark:text-neutral-500 text-center">
                  No active goals — nice work.
                </p>
              ) : (
                <div className="space-y-2">
                  {active.map((g, i) => (
                    <div key={g.id} onDragOver={(e) => onDragOver(e, i)} onDrop={(e) => e.preventDefault()}>
                      <GoalCard
                        goal={g}
                        onChange={load}
                        onOptimisticPatch={patchGoal}
                        countdown={countdown}
                        drag={{
                          onStart: (e) => {
                            dragIndex.current = i;
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', g.id);
                            const card = (e.currentTarget as HTMLElement).closest('[data-goal-card]') as HTMLElement | null;
                            if (card) e.dataTransfer.setDragImage(card, 20, 20);
                          },
                          onEnd: persistOrder,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {completed.length > 0 && (
                <div className="mt-5">
                  <button
                    onClick={toggleCompleted}
                    aria-expanded={showCompleted}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Completed ({completed.length})
                  </button>
                  {showCompleted && (
                    <div className="space-y-2 mt-2">
                      {completed.map((g) => (
                        <GoalCard
                          key={g.id}
                          goal={g}
                          onChange={load}
                          onOptimisticPatch={patchGoal}
                          countdown={countdown}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <TodoSection countdown={countdown} />
        </>
      )}
    </div>
  );
}
