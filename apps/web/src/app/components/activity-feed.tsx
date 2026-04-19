'use client';

interface Event {
  id: string;
  source: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
}

interface ActivityFeedProps {
  events: Event[];
}

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function eventLabel(type: string): string {
  switch (type) {
    case 'github.commit.pushed': return 'Commit';
    case 'github.pr.merged': return 'PR merged';
    case 'github.pr.reviewed': return 'Review';
    default: return type;
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
      return `#${payload.pr_number} in ${payload.repo}`;
    default:
      return '';
  }
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-8 text-center">
        No recent activity
      </p>
    );
  }

  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {events.map((event) => (
        <div key={event.id} className="py-3 flex items-start gap-3">
          <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500">
                {eventLabel(event.event_type)}
              </span>
              <span className="text-xs text-neutral-400">
                {formatRelativeTime(event.occurred_at)}
              </span>
            </div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
              {eventSummary(event.event_type, event.payload)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
