'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../lib/api';
import { useTimezone } from '../../lib/use-timezone';

interface CalEvent {
  id: string;
  occurred_at: string;
  duration_ms: number | null;
  payload: {
    summary?: string;
    category?: string;
    all_day?: boolean;
    attendee_count?: number;
    html_link?: string;
  } | null;
}

function formatDuration(ms: number | null, allDay?: boolean): string {
  if (allDay) return 'All day';
  if (!ms) return '';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function CalendarDayModal({
  since,
  until,
  title,
  onClose,
}: {
  since: string;
  until: string;
  title: string;
  onClose: () => void;
}) {
  const tz = useTimezone();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CalEvent[]>([]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: CalEvent[] }>(`/v1/events?source=google_calendar&since=${since}&until=${until}&limit=100`)
      .then((r) => setItems([...r.data].reverse())) // ascending by time
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [since, until]);

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

  const totalHours = Math.round((items.reduce((a, e) => a + (e.duration_ms ?? 0), 0) / 3_600_000) * 10) / 10;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Calendar</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {title} — {items.length} event{items.length !== 1 ? 's' : ''}
              {totalHours > 0 ? ` · ${totalHours}h` : ''}
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
            <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">No events on this day</p>
          ) : (
            <div className="space-y-2">
              {items.map((e) => {
                const summary = e.payload?.summary || '(no title)';
                const allDay = e.payload?.all_day;
                const time = allDay
                  ? 'All day'
                  : new Date(e.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
                const dur = formatDuration(e.duration_ms, allDay);
                const attendees = e.payload?.attendee_count ?? 0;
                const Wrapper = e.payload?.html_link ? 'a' : 'div';
                return (
                  <Wrapper
                    key={e.id}
                    {...(e.payload?.html_link ? { href: e.payload.html_link, target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className={`group/event flex items-start gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 transition-colors ${
                      e.payload?.html_link ? 'cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/50' : ''
                    }`}
                  >
                    <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 dark:text-white break-words leading-snug">{summary}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{time}</span>
                        {dur && !allDay && <span className="text-[10px] text-neutral-400 dark:text-neutral-500">· {dur}</span>}
                        {attendees > 0 && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">· {attendees} attendee{attendees !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
