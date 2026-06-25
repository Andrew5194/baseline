'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { PRESET_CATEGORIES } from '../../lib/categories';

const GITHUB_METRICS = [
  { value: 'commits', label: 'Commits', unit: 'commits' },
  { value: 'prs_merged', label: 'PRs merged', unit: 'PRs' },
  { value: 'reviews', label: 'Reviews', unit: 'reviews' },
  { value: 'active_days', label: 'Active days', unit: 'days' },
];
const CADENCES = [
  { value: 'day', label: 'day' },
  { value: 'week', label: 'week' },
  { value: 'month', label: 'month' },
  { value: 'year', label: 'year' },
];

interface AddGoalFormProps {
  knownCategories: string[];
  initialCadence?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddGoalForm({ knownCategories, initialCadence = 'day', onClose, onSuccess }: AddGoalFormProps) {
  const [type, setType] = useState<'time' | 'github'>('time');
  const [category, setCategory] = useState('');
  const [metric, setMetric] = useState('commits');
  const [target, setTarget] = useState('');
  const [cadence, setCadence] = useState(initialCadence);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categoryOptions = [...new Set([...PRESET_CATEGORIES, ...knownCategories])];
  const metricDef = GITHUB_METRICS.find((m) => m.value === metric)!;
  const unit = type === 'time' ? 'h' : metricDef.unit;
  const subject = type === 'time' ? category.trim() || 'that category' : metricDef.label.toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const t = parseFloat(target);
    if (!(t > 0)) return setError('Enter a target greater than 0');
    if (type === 'time' && !category.trim()) return setError('Choose a category');

    setLoading(true);
    try {
      await apiFetch('/v1/goals', {
        method: 'POST',
        body: JSON.stringify(
          type === 'time'
            ? { type: 'time', category: category.trim(), target: t, cadence }
            : { type: 'github', metric, target: t, cadence },
        ),
      });
      onSuccess();
      onClose();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const tab = (value: 'time' | 'github', label: string) => (
    <button
      type="button"
      onClick={() => setType(value)}
      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        type === value
          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
          : 'border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
      }`}
    >
      {label}
    </button>
  );

  const inputClass =
    'w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">New goal</h2>

      <div className="flex gap-2">
        {tab('time', 'Time')}
        {tab('github', 'GitHub')}
      </div>

      {type === 'time' ? (
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Category</label>
          <input
            list="goal-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Coding"
            className={inputClass}
          />
          <datalist id="goal-categories">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Metric</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className={inputClass}>
            {GITHUB_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            Target ({unit})
          </label>
          <input
            type="number"
            min="0"
            step={type === 'time' ? '0.5' : '1'}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={type === 'time' ? '1' : '5'}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500 mb-1">Per</label>
          <select value={cadence} onChange={(e) => setCadence(e.target.value)} className={inputClass}>
            {CADENCES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        At least{' '}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {target || '—'}
          {unit === 'h' ? 'h' : ` ${unit}`}
        </span>{' '}
        of {subject} every {cadence}.
      </p>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
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
