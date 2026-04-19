'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../lib/api';

interface EventItem {
  id: string;
  source: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
}

interface DayDetailsModalProps {
  date: string;
  contributionCount: number;
  onClose: () => void;
}

function eventLabel(type: string): string {
  switch (type) {
    case 'github.commit.pushed': return 'Commit';
    case 'github.pr.merged': return 'PR merged';
    case 'github.pr.reviewed': return 'Review';
    default: return type.split('.').pop() || type;
  }
}

function eventIcon(type: string): { icon: string; color: string } {
  switch (type) {
    case 'github.commit.pushed':
      return { icon: '⟐', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    case 'github.pr.merged':
      return { icon: '⊕', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' };
    case 'github.pr.reviewed':
      return { icon: '⊙', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' };
    default:
      return { icon: '◻', color: 'bg-neutral-500/10 text-neutral-500' };
  }
}

function eventSummary(type: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  switch (type) {
    case 'github.commit.pushed':
      return (payload.message as string)?.split('\n')[0] || '';
    case 'github.pr.merged':
      return (payload.title as string) || '';
    case 'github.pr.reviewed':
      return `Review on #${payload.pr_number}`;
    default:
      return '';
  }
}

function eventRepo(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const repo = payload.repo as string | undefined;
  return repo || null;
}

export function DayDetailsModal({ date, contributionCount, onClose }: DayDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const nextDay = new Date(date + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const until = nextDay.toISOString().split('T')[0];
        const data = await apiFetch<{ data: EventItem[] }>(
          `/v1/events?since=${date}&until=${until}&limit=100`,
        );
        setEvents(data.data);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [date]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Group events by type
  const commits = events.filter((e) => e.event_type === 'github.commit.pushed');
  const prs = events.filter((e) => e.event_type === 'github.pr.merged');
  const reviews = events.filter((e) => e.event_type === 'github.pr.reviewed');

  const categories = [
    { key: 'commits', label: 'Commits', items: commits },
    { key: 'prs', label: 'PRs', items: prs },
    { key: 'reviews', label: 'Reviews', items: reviews },
  ];

  const [selectedCategory, setSelectedCategory] = useState('commits');

  const activeItems = categories.find((c) => c.key === selectedCategory)?.items || [];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Activity Details</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {formattedDate} — {contributionCount} contribution{contributionCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No detailed activity found for this day</p>
            </div>
          ) : (
            <>
              {/* Category tabs */}
              <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-6">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-4 py-3 text-xs font-medium transition-colors relative ${
                      selectedCategory === cat.key
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    {cat.label}
                    {cat.items.length > 0 && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                        selectedCategory === cat.key
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}>
                        {cat.items.length}
                      </span>
                    )}
                    {selectedCategory === cat.key && (
                      <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-emerald-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Event list */}
              <div className="p-6 space-y-2">
                {activeItems.length === 0 ? (
                  <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">
                    No {selectedCategory} found for this day
                  </p>
                ) : (
                  activeItems.map((event) => {
                    const { icon, color } = eventIcon(event.event_type);
                    const repo = eventRepo(event.payload);
                    const sha = event.event_type === 'github.commit.pushed'
                      ? (event.payload?.sha as string)?.slice(0, 7)
                      : null;
                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${color}`}>
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 dark:text-white break-words leading-snug">
                            {eventSummary(event.event_type, event.payload)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {sha && (
                              <code className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                {sha}
                              </code>
                            )}
                            {repo && (
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                {repo}
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                              {new Date(event.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
