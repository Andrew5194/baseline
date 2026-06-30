'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/api';
import { useTimezone } from '../../../lib/use-timezone';
import { fmtDuration } from '../../../lib/time-units';
import { useTimeUnit } from '../../../lib/use-time-unit';

interface EventItem {
  id: string;
  source: string;
  event_type: string;
  occurred_at: string;
  duration_ms: number | null;
  payload: Record<string, unknown> | null;
}
interface EventsResponse {
  data: EventItem[];
  next_cursor: string | null;
}

type SourceFilter = 'all' | 'manual' | 'github';
const FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'manual', label: 'Time entries' },
  { key: 'github', label: 'GitHub' },
];

function eventMeta(type: string): { label: string; icon: string; color: string } {
  switch (type) {
    case 'manual.time_entry.created':
      return { label: 'Time entry', icon: '⏱', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    case 'github.commit.pushed':
      return { label: 'Commit', icon: '⟐', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
    case 'github.pr.merged':
      return { label: 'PR merged', icon: '⊕', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' };
    case 'github.pr.reviewed':
      return { label: 'Review', icon: '⊙', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' };
    default:
      return { label: type.split('.').pop() || type, icon: '◻', color: 'bg-neutral-500/10 text-neutral-500' };
  }
}

function summary(ev: EventItem): string {
  const p = ev.payload ?? {};
  switch (ev.event_type) {
    case 'manual.time_entry.created':
      return [p.category, p.note].filter(Boolean).join(' — ');
    case 'github.commit.pushed':
      return ((p.message as string) || '').split('\n')[0];
    case 'github.pr.merged':
      return (p.title as string) || '';
    case 'github.pr.reviewed':
      return `Review on #${p.pr_number}`;
    default:
      return '';
  }
}

const repoOf = (p: Record<string, unknown> | null) => {
  const repo = p?.repo as string | undefined;
  return repo ? repo.split('/').pop() || repo : null;
};
const dayKey = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone });
const timeOf = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
// Full date + time for the saved-time tooltip.
const fullStamp = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  });
// "0 days, 8 hours, and 30 minutes" breakdown for the duration tooltip.
const durationBreakdown = (ms: number): string => {
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return `${part(days, 'day')}, ${part(hours, 'hour')}, and ${part(mins, 'minute')}`;
};

export default function History() {
  const tz = useTimezone();
  const [unit] = useTimeUnit();
  const [source, setSource] = useState<SourceFilter>('all');
  const [items, setItems] = useState<EventItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const url = useCallback(
    (c?: string) =>
      `/v1/events?limit=50${source !== 'all' ? `&source=${source}` : ''}${c ? `&cursor=${c}` : ''}`,
    [source],
  );

  useEffect(() => {
    setLoading(true);
    setItems([]);
    apiFetch<EventsResponse>(url())
      .then((r) => {
        setItems(r.data);
        setCursor(r.next_cursor);
        setHasMore(!!r.next_cursor);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [url]);

  async function loadMore() {
    if (!cursor) return;
    const r = await apiFetch<EventsResponse>(url(cursor)).catch(console.error);
    if (!r) return;
    setItems((prev) => [...prev, ...r.data]);
    setCursor(r.next_cursor);
    setHasMore(!!r.next_cursor);
  }

  async function deleteEntry(id: string) {
    await apiFetch(`/v1/time-entries/${id}`, { method: 'DELETE' }).catch(console.error);
    setItems((prev) => prev.filter((e) => e.id !== id));
  }

  // Group consecutive items by day for date headers.
  const groups: Array<{ day: string; items: EventItem[] }> = [];
  for (const ev of items) {
    const day = dayKey(ev.occurred_at, tz);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(ev);
    else groups.push({ day, items: [ev] });
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Everything that&apos;s happened, most recent first</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSource(f.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                source === f.key
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded-lg shimmer" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center text-sm text-neutral-400 dark:text-neutral-500">
          No activity yet.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.day}>
              <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                {g.day}
              </p>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800">
                {g.items.map((ev) => {
                  const meta = eventMeta(ev.event_type);
                  const repo = repoOf(ev.payload);
                  const hours = ev.duration_ms != null ? ev.duration_ms / 3_600_000 : null;
                  const isManual = ev.source === 'manual';
                  return (
                    <div key={ev.id} className="flex items-start gap-3 px-4 py-3 group">
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{meta.label}</span>
                          {repo && (
                            <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">
                              {repo}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{summary(ev)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500 cursor-default" title={fullStamp(ev.occurred_at, tz)}>
                          {timeOf(ev.occurred_at, tz)}
                        </span>
                        {hours !== null && ev.duration_ms != null && (
                          <span
                            className="text-sm font-medium text-neutral-900 dark:text-white tabular-nums cursor-default"
                            title={durationBreakdown(ev.duration_ms)}
                          >
                            {fmtDuration(hours, unit)}
                          </span>
                        )}
                      </div>
                      {isManual ? (
                        <button
                          onClick={() => deleteEntry(ev.id)}
                          aria-label="Delete entry"
                          className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1 flex-shrink-0"
                        >
                          ×
                        </button>
                      ) : (
                        <span className="w-5 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
