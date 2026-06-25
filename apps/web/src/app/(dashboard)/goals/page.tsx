'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/api';
import { Modal } from '../../components/modal';
import { AddGoalForm } from '../../components/add-goal-form';
import { GoalCard, type Goal, type Cadence, CADENCE_ADVERB } from '../../components/goal-card';
import { CadenceSelector } from '../../components/cadence-selector';
import { cadenceRangeLabel } from '../../components/period-selector';
import { useTimezone } from '../../../lib/use-timezone';
import { TodoSection } from '../../components/todo-section';

const EXAMPLE: Record<Cadence, string> = {
  day: 'e.g. at least 1h Coding every day',
  week: 'e.g. 5 PRs merged each week',
  month: 'e.g. 40h Deep Work each month',
  year: 'e.g. merge 100 PRs this year',
};

export default function Goals() {
  const tz = useTimezone();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [cadence, setCadence] = useState<Cadence>('day');

  const load = useCallback(
    () => apiFetch<{ data: Goal[] }>('/v1/goals').then((r) => setGoals(r.data)).catch(console.error),
    [],
  );

  useEffect(() => {
    load();
    apiFetch<{ categories: string[] }>('/v1/time-entries?period=year')
      .then((r) => setCategories(r.categories ?? []))
      .catch(() => {});
    const onChange = () => load();
    window.addEventListener('baseline:goals-changed', onChange);
    return () => window.removeEventListener('baseline:goals-changed', onChange);
  }, [load]);

  const visible = goals?.filter((g) => g.cadence === cadence) ?? null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{cadenceRangeLabel(cadence, tz)}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CadenceSelector value={cadence} onChange={setCadence} />
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
          <AddGoalForm
            knownCategories={categories}
            initialCadence={cadence}
            onClose={() => setAdding(false)}
            onSuccess={load}
          />
        </Modal>
      )}

      {goals === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
          ))}
        </div>
      ) : visible && visible.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No {CADENCE_ADVERB[cadence]} goals yet.</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{EXAMPLE[cadence]}</p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
          >
            Create a {CADENCE_ADVERB[cadence]} goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible!.map((g) => (
            <GoalCard key={g.id} goal={g} onChange={load} />
          ))}
        </div>
      )}

      {/* To-do is a daily checklist for now — only shown under the Daily tab. */}
      {cadence === 'day' && <TodoSection />}
    </div>
  );
}
