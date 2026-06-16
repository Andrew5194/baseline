'use client';

import { useState } from 'react';
import { API_URL } from '../../lib/api';
import { PRESET_CATEGORIES } from '../../lib/categories';

export interface EditableEntry {
  id: string;
  occurred_at: string;
  hours: number;
  category: string;
  note: string | null;
}

interface AddTimeEntryFormProps {
  knownCategories: string[];
  onClose: () => void;
  onSuccess: () => void;
  // When set, the form edits this entry (PUT) instead of creating one (POST).
  entry?: EditableEntry | null;
  // Provided in edit mode so the user can remove the entry from the same dialog.
  onDelete?: () => void;
}

const CUSTOM = '__custom__';
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

export function AddTimeEntryForm({ knownCategories, onClose, onSuccess, entry, onDelete }: AddTimeEntryFormProps) {
  const isEdit = !!entry;
  const options = [...new Set([...PRESET_CATEGORIES, ...knownCategories, ...(entry ? [entry.category] : [])])];
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(entry ? new Date(entry.occurred_at).toISOString().split('T')[0] : today);
  const [hours, setHours] = useState(entry ? String(entry.hours) : '');
  const [category, setCategory] = useState(entry?.category ?? options[0] ?? 'Deep Work');
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cat = category === CUSTOM ? customCategory.trim() : category;
    if (!cat) return setError('Enter a category name');
    const h = parseFloat(hours);
    if (!(h > 0)) return setError('Enter hours greater than 0');

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/time-entries${isEdit ? `/${entry!.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          occurred_at: `${date}T12:00:00.000Z`,
          hours: h,
          category: cat,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed to ${isEdit ? 'save' : 'add'} entry`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4 shadow-lg"
    >
      <p className="text-sm font-medium text-neutral-900 dark:text-white">{isEdit ? 'Edit time entry' : 'Add time entry'}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="te-date" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Date
          </label>
          <input id="te-date" type="date" required value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="te-hours" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Hours
          </label>
          <input
            id="te-hours"
            type="number"
            step="0.5"
            min="0.5"
            max="24"
            required
            placeholder="e.g. 2.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="te-category" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Category
        </label>
        <select id="te-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>
        {category === CUSTOM && (
          <input
            type="text"
            placeholder="New category name"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="te-note" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Note (optional)
        </label>
        <input id="te-note" type="text" placeholder="What were you working on?" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
        {isEdit && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
