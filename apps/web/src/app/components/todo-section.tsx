'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

interface Todo {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export function TodoSection() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [title, setTitle] = useState('');

  const load = useCallback(
    () => apiFetch<{ data: Todo[] }>('/v1/todos').then((r) => setTodos(r.data)).catch(console.error),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle('');
    await apiFetch('/v1/todos', { method: 'POST', body: JSON.stringify({ title: t }) }).catch(console.error);
    load();
  }

  async function toggle(todo: Todo) {
    setTodos((ts) => ts?.map((x) => (x.id === todo.id ? { ...x, done: !x.done } : x)) ?? null);
    await apiFetch(`/v1/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ done: !todo.done }) }).catch(console.error);
    load();
  }

  async function remove(id: string) {
    setTodos((ts) => ts?.filter((x) => x.id !== id) ?? null);
    await apiFetch(`/v1/todos/${id}`, { method: 'DELETE' }).catch(console.error);
  }

  const openCount = todos?.filter((t) => !t.done).length ?? 0;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
          To-do
          {todos && todos.length > 0 && (
            <span className="ml-2 text-xs font-normal text-neutral-400 dark:text-neutral-500">{openCount} open</span>
          )}
        </h2>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Add row */}
        <form onSubmit={add} className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <span className="w-4 h-4 rounded-[5px] border border-dashed border-neutral-300 dark:border-neutral-600 flex-shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
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
        ) : todos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-400 dark:text-neutral-500 text-center">No tasks yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {todos.map((t) => (
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
                  {t.done && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 text-sm truncate ${
                    t.done ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {t.title}
                </span>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Delete task"
                  className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none flex-shrink-0"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
