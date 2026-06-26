'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';

interface AddGoalFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddGoalForm({ onClose, onSuccess }: AddGoalFormProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const t = title.trim();
    if (!t) return setError('Enter what you want to accomplish');

    setLoading(true);
    try {
      await apiFetch('/v1/goals', { method: 'POST', body: JSON.stringify({ title: t }) });
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
