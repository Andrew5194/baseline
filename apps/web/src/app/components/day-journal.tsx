'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';

// A per-day journal subsection (mirrors the Tasks subsection). Loads the entry for
// `day` and saves edits (on blur, via the Save button, or when the day switches).
// The textarea auto-grows with its content.
export function DayJournal({ day, dayLabel }: { day: string; dayLabel: string }) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  // Mirror the latest content/saved so the day-switch cleanup can flush correctly.
  const latest = useRef({ content: '', saved: '' });
  latest.current = { content, saved };

  function persist(date: string, text: string) {
    return apiFetch(`/v1/day-notes`, { method: 'PUT', body: JSON.stringify({ date, content: text }) }).catch(console.error);
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
      // Flush the day we're leaving if it has unsaved edits.
      const { content: c, saved: s } = latest.current;
      if (c !== s) persist(loadingDay, c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function save() {
    if (content === saved) return;
    setSaving(true);
    setSaved(content);
    await persist(day, content);
    setSaving(false);
  }

  const dirty = content !== saved;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Notes</h2>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden transition focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/30">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{dayLabel}</p>
          <div className="text-[11px]">
            {saving ? (
              <span className="text-neutral-400 dark:text-neutral-500">Saving…</span>
            ) : dirty ? (
              <button onClick={save} className="font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500">
                Save
              </button>
            ) : content ? (
              <span className="text-neutral-400 dark:text-neutral-500">Saved</span>
            ) : null}
          </div>
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
            onBlur={save}
            placeholder="How did today go? Jot down your thoughts and feelings…"
            className="block w-full min-h-[120px] px-4 py-3 text-sm bg-transparent text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none resize-none leading-relaxed overflow-hidden"
          />
        )}
      </div>
    </section>
  );
}
