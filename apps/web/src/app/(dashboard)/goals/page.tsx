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
  const dragIndex = useRef<number | null>(null);
  const orderRef = useRef<Goal[]>([]);

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
    setGoals((gs) => {
      if (!gs) return gs;
      const next = [...gs];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    dragIndex.current = i;
  }

  async function persistOrder() {
    dragIndex.current = null;
    const ids = orderRef.current.map((g) => g.id);
    if (ids.length) {
      await apiFetch('/v1/goals/reorder', { method: 'POST', body: JSON.stringify({ ids }) }).catch(console.error);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Things you want to accomplish</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex flex-shrink-0 items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium whitespace-nowrap hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
        >
          <span className="text-sm leading-none">+</span>
          New goal
        </button>
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
            <div className="space-y-2">
              {goals.map((g, i) => (
                <div key={g.id} onDragOver={(e) => onDragOver(e, i)} onDrop={(e) => e.preventDefault()}>
                  <GoalCard
                    goal={g}
                    onChange={load}
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

          <TodoSection />
        </>
      )}
    </div>
  );
}
