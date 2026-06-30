'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { PRESET_CATEGORIES } from '../../lib/categories';

interface AddGoalFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CUSTOM = '__custom__';

export function AddGoalForm({ onClose, onSuccess }: AddGoalFormProps) {
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(PRESET_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [known, setKnown] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Offer every category the user already uses (presets + created/used ones).
  useEffect(() => {
    apiFetch<{ categories: Array<{ name: string }> }>('/v1/categories')
      .then((r) => setKnown((r.categories ?? []).map((c) => c.name)))
      .catch(() => {});
  }, []);
  const options = [...new Set([...PRESET_CATEGORIES, ...known])];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const t = title.trim();
    if (!t) return setError('Enter what you want to accomplish');
    const category = (cat === CUSTOM ? customCat.trim() : cat).trim();
    if (!category) return setError('Pick or name a category');

    setLoading(true);
    try {
      await apiFetch('/v1/goals', { method: 'POST', body: JSON.stringify({ title: t, category, due_at: dueAt || null }) });
      onSuccess();
      onClose();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-6 space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">New goal</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">What are you trying to accomplish?</p>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Ship the billing page"
        className="w-full text-sm px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      />

      <div>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          Category — time on this goal rolls up here
        </label>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>
        {cat === CUSTOM && (
          <input
            value={customCat}
            onChange={(e) => setCustomCat(e.target.value)}
            placeholder="New category name"
            className="mt-2 w-full text-sm px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          Target date — when you want this done by (optional)
        </label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Create goal'}
        </button>
      </div>
    </form>
  );
}
