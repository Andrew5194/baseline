'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../../lib/api';
import { usePreference } from '../../../lib/use-preference';
import { Modal } from '../../components/modal';
import { AddGoalForm } from '../../components/add-goal-form';
import { GoalCard, type Goal } from '../../components/goal-card';
import { TodoSection } from '../../components/todo-section';

const COMPLETED_PAGE = 20;

export default function Goals() {
  // Active (open) goals are always loaded; completed goals are lazy-loaded in pages
  // only when the "Completed" section is expanded, so the page stays fast no matter
  // how many goals have been finished. `completedTotal` powers the count label
  // without loading the list.
  const [active, setActive] = useState<Goal[] | null>(null);
  const [completed, setCompleted] = useState<Goal[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedHasMore, setCompletedHasMore] = useState(false);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  // Count-down mode — reframes due dates and task counts as "time/tasks left". Synced
  // server-side (users.preferences via /v1/me) so it follows the user across devices.
  const [countdown, setCountdown] = usePreference('goalsCountdown');
  // Completed goals collapse into a disclosure at the bottom; remember open/closed
  // per-user (synced across devices).
  const [showCompleted, setShowCompleted] = usePreference('goalsShowCompleted');
  const dragIndex = useRef<number | null>(null);
  const orderRef = useRef<Goal[]>([]);
  const activeRef = useRef<Goal[] | null>(null);
  const completedRef = useRef<Goal[]>([]);
  const completedLoadedRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
    if (active) orderRef.current = active;
  }, [active]);
  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);
  useEffect(() => {
    completedLoadedRef.current = completedLoaded;
  }, [completedLoaded]);

  const toggleCountdown = () => setCountdown(!countdown);
  const toggleCompleted = () => setShowCompleted(!showCompleted);

  // Active goals + the completed count. Never touches the loaded `completed` pages,
  // so an expanded section doesn't collapse when this refetches (e.g. on a task-tag
  // change that fires baseline:goals-changed).
  const load = useCallback(
    () =>
      apiFetch<{ data: Goal[]; completed_count: number }>('/v1/goals')
        .then((r) => {
          setActive(r.data);
          setCompletedTotal(r.completed_count);
        })
        .catch(console.error),
    [],
  );

  // Fetch a page of completed goals. `reset` starts from the top (first expand);
  // otherwise it appends the next page from the current offset.
  const loadCompleted = useCallback((reset: boolean) => {
    const offset = reset ? 0 : completedRef.current.length;
    setLoadingCompleted(true);
    return apiFetch<{ data: Goal[]; has_more: boolean }>(
      `/v1/goals?status=completed&limit=${COMPLETED_PAGE}&offset=${offset}`,
    )
      .then((r) => {
        setCompleted((prev) => {
          const base = reset ? [] : prev;
          const seen = new Set(base.map((g) => g.id));
          return [...base, ...r.data.filter((g) => !seen.has(g.id))];
        });
        setCompletedHasMore(r.has_more);
        setCompletedLoaded(true);
      })
      .catch(console.error)
      .finally(() => setLoadingCompleted(false));
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('baseline:goals-changed', onChange);
    return () => window.removeEventListener('baseline:goals-changed', onChange);
  }, [load]);

  // Lazy-load the completed list the first time the section is shown (either via the
  // toggle or restored open from localStorage).
  useEffect(() => {
    if (showCompleted && !completedLoaded) loadCompleted(true);
  }, [showCompleted, completedLoaded, loadCompleted]);

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
    setActive((as) => {
      if (!as) return as;
      const next = [...as];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    dragIndex.current = i;
  }

  // Optimistically apply a partial update to a goal so its card responds instantly.
  // A `done` transition moves the goal between the active list and the completed
  // section (and adjusts the count); other patches (color, title) update in place.
  const patchGoal = useCallback((id: string, patch: Partial<Goal>) => {
    if (patch.done === true) {
      const g = (activeRef.current ?? []).find((x) => x.id === id);
      if (g) {
        const moved = { ...g, ...patch };
        setActive((as) => (as ?? []).filter((x) => x.id !== id));
        // Only insert into the completed list if it's been loaded; otherwise the
        // bumped count is enough and the goal appears when the section is opened.
        if (completedLoadedRef.current) {
          setCompleted((cs) => [moved, ...cs.filter((c) => c.id !== id)]);
        }
        setCompletedTotal((n) => n + 1);
        return;
      }
    } else if (patch.done === false) {
      const g = completedRef.current.find((x) => x.id === id);
      if (g) {
        const moved = { ...g, ...patch };
        setCompleted((cs) => cs.filter((x) => x.id !== id));
        setActive((as) => [...(as ?? []), moved]);
        setCompletedTotal((n) => Math.max(0, n - 1));
        return;
      }
    }
    // In-place update (color/title, or a done value that didn't move lists).
    setActive((as) => as?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? as);
    setCompleted((cs) => cs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  // Optimistically drop a deleted goal from whichever list holds it (and adjust the
  // completed count if it was completed), so it doesn't linger as a ghost — load()
  // only refetches active goals + the count, never the loaded completed pages.
  const removeGoal = useCallback((id: string) => {
    const wasCompleted = completedRef.current.some((x) => x.id === id);
    setActive((as) => as?.filter((x) => x.id !== id) ?? as);
    setCompleted((cs) => cs.filter((x) => x.id !== id));
    if (wasCompleted) setCompletedTotal((n) => Math.max(0, n - 1));
  }, []);

  async function persistOrder() {
    dragIndex.current = null;
    // Only active goals carry a manual order; the reorder endpoint sets position by
    // index for the ids sent and leaves completed goals' positions untouched.
    const ids = orderRef.current.map((g) => g.id);
    if (ids.length) {
      await apiFetch('/v1/goals/reorder', { method: 'POST', body: JSON.stringify({ ids }) }).catch(
        console.error,
      );
    }
  }

  // Completed goals render newest-completion-first (server order; a just-completed
  // goal is prepended optimistically, so re-sort defensively).
  const completedSorted = completed
    .slice()
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Things you want to accomplish
          </p>
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

      {active === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <>
          {/* One message for any "no active goals" state — a brand-new user and
              someone between goals see the same thing (no dynamic onboarding copy). */}
          {active.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No active goals.</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Add a new goal to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((g, i) => (
                <div
                  key={g.id}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={(e) => e.preventDefault()}
                >
                  <GoalCard
                    goal={g}
                    onChange={load}
                    onOptimisticPatch={patchGoal}
                    onOptimisticRemove={removeGoal}
                    countdown={countdown}
                    drag={{
                      onStart: (e) => {
                        dragIndex.current = i;
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', g.id);
                        const card = (e.currentTarget as HTMLElement).closest(
                          '[data-goal-card]',
                        ) as HTMLElement | null;
                        if (card) e.dataTransfer.setDragImage(card, 20, 20);
                      },
                      onEnd: persistOrder,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {completedTotal > 0 && (
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Completed ({completedTotal})
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2">
                  {completedSorted.map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      onChange={load}
                      onOptimisticPatch={patchGoal}
                      onOptimisticRemove={removeGoal}
                      countdown={countdown}
                    />
                  ))}
                  {loadingCompleted && completedSorted.length === 0 && (
                    <div className="space-y-2">
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer"
                        />
                      ))}
                    </div>
                  )}
                  {completedHasMore && (
                    <button
                      onClick={() => loadCompleted(false)}
                      disabled={loadingCompleted}
                      className="w-full py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {loadingCompleted ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <TodoSection countdown={countdown} />
        </>
      )}
    </div>
  );
}
