'use client';

import { useState } from 'react';
import { API_URL } from '../../lib/api';
import { PRESET_CATEGORIES } from '../../lib/categories';
import { startTimer } from '../../lib/focus-timer';

// Local "YYYY-MM-DDTHH:mm" (a datetime-local input value) of an instant in `timeZone`.
const toLocalInput = (d: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
};

export interface EditableEntry {
  id: string;
  occurred_at: string;
  hours: number;
  category: string;
  note: string | null;
  timed?: boolean;
}

interface AddTimeEntryFormProps {
  knownCategories: string[];
  onClose: () => void;
  onSuccess: () => void;
  // The user's resolved timezone, passed in so the date prefill never races the
  // async timezone hook (which would briefly resolve to UTC and shift the day).
  tz: string;
  // When set, the form edits this entry (PUT) instead of creating one (POST).
  entry?: EditableEntry | null;
  // Provided in edit mode so the user can remove the entry from the same dialog.
  onDelete?: () => void;
}

const CUSTOM = '__custom__';
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';
// Tighter font/padding so a full datetime value sits flush beside the native
// calendar icon in a half-width field.
const dtInputClass =
  'w-full px-2 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

export function AddTimeEntryForm({ knownCategories, onClose, onSuccess, tz, entry, onDelete }: AddTimeEntryFormProps) {
  const isEdit = !!entry;
  const options = [...new Set([...PRESET_CATEGORIES, ...knownCategories, ...(entry ? [entry.category] : [])])];

  // Default a new entry to the past hour; prefill an edit from its real start/end.
  const now = new Date();
  const initEnd = entry ? new Date(entry.occurred_at) : now;
  const initStart = entry ? new Date(initEnd.getTime() - entry.hours * 3_600_000) : new Date(now.getTime() - 3_600_000);

  const today = toLocalInput(now, tz).slice(0, 10);

  const [mode, setMode] = useState<'log' | 'timer'>('log');
  // 'hours' = type the number of hours (default); 'range' = pick start/end and derive
  // it. Editing a timer/range entry opens in range mode to match how it was logged.
  const [inputMode, setInputMode] = useState<'range' | 'hours'>(entry?.timed ? 'range' : 'hours');
  const [from, setFrom] = useState(toLocalInput(initStart, tz));
  const [to, setTo] = useState(toLocalInput(initEnd, tz));
  const [date, setDate] = useState(toLocalInput(initEnd, tz).slice(0, 10));
  const [hours, setHours] = useState(entry ? String(entry.hours) : '1');
  const [category, setCategory] = useState(entry?.category ?? options[0] ?? 'Deep Work');
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resolvedCategory = () => (category === CUSTOM ? customCategory.trim() : category);

  // In range mode, hours are derived from the two wall-clocks (the difference is
  // tz-agnostic, so parsing them as local is fine for the readout).
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const validRange = !isNaN(fromMs) && !isNaN(toMs) && toMs > fromMs;
  const computedHours = validRange ? Math.round(((toMs - fromMs) / 3_600_000) * 100) / 100 : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cat = resolvedCategory();
    if (!cat) return setError('Enter a category name');

    let timing: Record<string, unknown>;
    if (inputMode === 'range') {
      if (!validRange) return setError('End time must be after start time');
      timing = { from, to };
    } else {
      const h = parseFloat(hours);
      if (!(h > 0)) return setError('Enter hours greater than 0');
      timing = { date, hours: h };
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/time-entries${isEdit ? `/${entry!.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...timing,
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

  function startSession() {
    setError('');
    const cat = resolvedCategory();
    if (!cat) return setError('Enter a category name');
    startTimer(cat, note.trim());
    onClose();
  }

  const categoryField = (
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
  );

  const noteField = (
    <div className="space-y-1.5">
      <label htmlFor="te-note" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        Note (optional)
      </label>
      <input id="te-note" type="text" placeholder="What were you working on?" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
    </div>
  );

  const tabBtn = (active: boolean) =>
    `flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
    }`;

  return (
    <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4 shadow-lg">
      <p className="text-sm font-medium text-neutral-900 dark:text-white">{isEdit ? 'Edit time entry' : 'Add time entry'}</p>

      {!isEdit && (
        <div className="flex gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <button type="button" onClick={() => setMode('log')} className={tabBtn(mode === 'log')}>
            Log time
          </button>
          <button type="button" onClick={() => setMode('timer')} className={tabBtn(mode === 'timer')}>
            Timer
          </button>
        </div>
      )}

      {mode === 'timer' && !isEdit ? (
        <div className="space-y-4">
          {categoryField}
          {noteField}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startSession}
              className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              Start timer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            The timer runs in the background — stop it on the Overview to log the time.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-5">
            {(
              [
                ['hours', 'Hours'],
                ['range', 'Start & end'],
              ] as const
            ).map(([val, label]) => (
              <label key={val} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <input
                  type="radio"
                  name="te-input-mode"
                  checked={inputMode === val}
                  onChange={() => setInputMode(val)}
                  className="w-3.5 h-3.5 accent-emerald-600"
                />
                {label}
              </label>
            ))}
          </div>

          {inputMode === 'range' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="te-from" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    From
                  </label>
                  <input id="te-from" type="datetime-local" required value={from} onChange={(e) => setFrom(e.target.value)} className={dtInputClass} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="te-to" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    To
                  </label>
                  <input id="te-to" type="datetime-local" required value={to} onChange={(e) => setTo(e.target.value)} className={dtInputClass} />
                </div>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Duration:{' '}
                <span className={`font-medium ${computedHours == null ? 'text-red-500' : 'text-neutral-700 dark:text-neutral-300'}`}>
                  {computedHours == null ? 'End must be after start' : `${computedHours}h`}
                </span>
              </p>
            </>
          ) : (
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
                <input id="te-hours" type="number" step="any" min="0.01" max="168" required placeholder="e.g. 2.5" value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {categoryField}
          {noteField}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || (inputMode === 'range' && !validRange)}
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
      )}
    </div>
  );
}
