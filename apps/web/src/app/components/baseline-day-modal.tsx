'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../lib/api';
import { useTimezone } from '../../lib/use-timezone';
import { type TimeUnit, fmtDuration } from '../../lib/time-units';

interface CompletedItem {
  id: string;
  title: string;
  completed_at: string | null;
  category: string | null;
}
interface EntryItem {
  id: string;
  occurred_at: string;
  hours: number;
  category: string | null;
  note: string | null;
}
type Kind = 'goals' | 'tasks' | 'entries';

interface ItemsResponse {
  kind: Kind;
  items: CompletedItem[] | EntryItem[];
}

const GoalIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
  </svg>
);
const ClockIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function BaselineDayModal({
  metric,
  label,
  since,
  until,
  title,
  unit,
  onClose,
}: {
  metric: string;
  label: string;
  since: string;
  until: string;
  title: string;
  unit: TimeUnit;
  onClose: () => void;
}) {
  const tz = useTimezone();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ItemsResponse | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<ItemsResponse>(`/v1/metrics/baseline/items?metric=${metric}&since=${since}&until=${until}`)
      .then(setData)
      .catch(() => setData({ kind: 'entries', items: [] }))
      .finally(() => setLoading(false));
  }, [metric, since, until]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const kind = data?.kind ?? 'entries';
  const items = data?.items ?? [];
  const totalHours = kind === 'entries' ? (items as EntryItem[]).reduce((a, e) => a + e.hours, 0) : 0;

  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{label}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {title} — {items.length} {kind === 'goals' ? 'goal' : kind === 'tasks' ? 'task' : 'entr'}
              {kind === 'entries' ? (items.length !== 1 ? 'ies' : 'y') : items.length !== 1 ? 's' : ''}
              {kind === 'entries' && totalHours > 0 ? ` · ${fmtDuration(totalHours, unit)}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain p-6">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">Nothing in this period</p>
          ) : kind === 'entries' ? (
            <div className="space-y-2">
              {(items as EntryItem[]).map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                  <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {ClockIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 dark:text-white break-words leading-snug">{e.note || e.category || 'Time entry'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{time(e.occurred_at)}</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">· {fmtDuration(e.hours, unit)}</span>
                      {e.category && <span className="text-[10px] text-neutral-400 dark:text-neutral-500">· {e.category}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(items as CompletedItem[]).map((c) => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                  <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {GoalIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 dark:text-white break-words leading-snug">{c.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.completed_at && <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Completed {time(c.completed_at)}</span>}
                      {c.category && <span className="text-[10px] text-neutral-400 dark:text-neutral-500">· {c.category}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
