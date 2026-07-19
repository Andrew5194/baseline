import { apiFetch } from './api';

export interface TaskEntry {
  id: string;
  occurred_at: string;
  hours: number;
  timed: boolean;
}

// A tiny stale-while-revalidate cache for a task's logged time sessions, keyed by
// task id. Opening a task's time-logs panel reads any cached value instantly and
// revalidates in the background, so re-opening (or opening after a prefetch on the
// kebab) is immediate instead of paying a fresh round-trip every time.
const cache = new Map<string, TaskEntry[]>();
const inflight = new Map<string, Promise<TaskEntry[]>>();

export function getCachedTaskEntries(taskId: string): TaskEntry[] | undefined {
  return cache.get(taskId);
}

export function fetchTaskEntries(taskId: string): Promise<TaskEntry[]> {
  // Coalesce concurrent requests for the same task into one in-flight fetch.
  const existing = inflight.get(taskId);
  if (existing) return existing;
  const p = apiFetch<{ data: TaskEntry[] }>(`/v1/time-entries?task_id=${encodeURIComponent(taskId)}`)
    .then((r) => {
      const entries = r.data ?? [];
      cache.set(taskId, entries);
      return entries;
    })
    .catch(() => cache.get(taskId) ?? [])
    .finally(() => inflight.delete(taskId));
  inflight.set(taskId, p);
  return p;
}

// Warm the cache ahead of time (e.g. when the task's kebab menu opens).
export function prefetchTaskEntries(taskId: string): void {
  if (!cache.has(taskId) && !inflight.has(taskId)) void fetchTaskEntries(taskId);
}

// Drop the cached value so the next read refetches (e.g. after logging a session).
export function invalidateTaskEntries(taskId: string): void {
  cache.delete(taskId);
}
