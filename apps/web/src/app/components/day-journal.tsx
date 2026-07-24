'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';

// How long to wait after the last keystroke before autosaving. Deliberately roomy so a
// slip (or an accidental clear) can be undone before it's committed.
const AUTOSAVE_MS = 2500;

// Per-day journal subsection. Loads the entry for `day` and saves edits (on blur, via
// the Save button, or when the day switches). The textarea auto-grows with its content.
export function DayJournal({ day, dayLabel }: { day: string; dayLabel: string }) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  // Mirror the latest content/saved so the debounce timer and day-switch cleanup
  // always flush the current text (no stale closures).
  const latest = useRef({ content: '', saved: '' });
  latest.current = { content, saved };
  const savingRef = useRef(false);

  function persist(date: string, text: string) {
    return apiFetch(`/v1/day-notes`, { method: 'PUT', body: JSON.stringify({ date, content: text }) });
  }

  // Grow the textarea to fit its content (no manual resize handle).
  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
  useEffect(autosize, [content, loading]);

  useEffect(() => {
    const loadingDay = day;
    let cancelled = false;
    setLoading(true);
    apiFetch<{ content: string }>(`/v1/day-notes?date=${day}`)
      .then((r) => {
        if (cancelled) return;
        setContent(r.content ?? '');
        setSaved(r.content ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setContent('');
        setSaved('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Flush the day we're leaving if it has unsaved edits (safety net against losing
      // a journal entry when navigating days — distinct from the explicit Update button).
      const { content: c, saved: s } = latest.current;
      if (c !== s) persist(loadingDay, c).catch(console.error);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function save() {
    const { content: c, saved: s } = latest.current;
    if (c === s || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    try {
      await persist(day, c);
      setSaved(c);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const dirty = content !== saved;

  // Debounced autosave after the last keystroke. Re-runs on each edit so the timer
  // trails the latest text; the day-switch cleanup flushes the rest.
  useEffect(() => {
    if (loading || !dirty) return;
    const t = setTimeout(save, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dirty, loading, saving]);

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Notes</h2>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{dayLabel}</p>
          {saving ? (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Saving…</span>
          ) : error ? (
            <span className="text-[11px] text-red-500">Couldn’t save</span>
          ) : dirty ? (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Unsaved…</span>
          ) : content ? (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Saved</span>
          ) : null}
        </div>

        {loading ? (
          <div className="p-4">
            <div className="h-24 bg-neutral-100 dark:bg-neutral-800 rounded shimmer" />
          </div>
        ) : (
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onInput={autosize}
            placeholder="How did today go? Jot down your thoughts and feelings…"
            className="block w-full min-h-[120px] px-4 py-3 text-sm bg-transparent text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none resize-none leading-relaxed overflow-hidden"
          />
        )}
      </div>
    </section>
  );
}
