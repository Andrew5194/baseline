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
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

function eventLabel(type: string): string {
  switch (type) {
    case 'github.commit.pushed': return 'Commit';
    case 'github.pr.merged': return 'PR merged';
    case 'github.pr.reviewed': return 'Review';
    default: return type.split('.').pop() || type;
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
  if (!repo) return null;
  return repo.includes('/') ? repo.split('/').pop() || repo : repo;
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
      {events.map((event) => {
        const { icon, color } = eventIcon(event.event_type);
        const repo = eventRepo(event.payload);
        return (
          <div key={event.id} className="py-3 flex items-start gap-3">
            <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${color}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">
                  {eventLabel(event.event_type)}
                </span>
                {repo && (
                  <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">
                    {repo}
                  </span>
                )}
                <span className="text-xs text-neutral-400 ml-auto flex-shrink-0">
                  {formatRelativeTime(event.occurred_at)}
                </span>
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                {eventSummary(event.event_type, event.payload)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
