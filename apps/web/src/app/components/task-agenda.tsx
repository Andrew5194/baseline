'use client';

import { goalColor } from '../../lib/goal-colors';

// Task shapes as returned by GET /v1/todos (all of the user's one-off tasks, recurring
// definitions, and recurring completions — the endpoint's `data`/`recurring`/`completions`).
interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  date: string; // scheduled day (YYYY-MM-DD)
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
  category: string | null;
}
interface RecurringItem {
  id: string;
  title: string;
  days_mask: number;
  since: string; // doesn't apply before this day
  goal_id: string | null;
  goal_title: string | null;
  goal_color: string | null;
  category: string | null;
}
interface CompletionItem {
  recurring_todo_id: string;
  date: string;
}
export interface AgendaTasks {
  data: TodoItem[];
  recurring: RecurringItem[];
  completions: CompletionItem[];
}

interface TaskAgendaProps {
  // The chart's buckets — day keys (YYYY-MM-DD) for week/month, month keys (YYYY-MM-01)
  // for the year view. The agenda groups tasks under these same buckets so its rows line
  // up with the bar/calendar views.
  buckets: string[];
  granularity: 'day' | 'month';
  tasks: AgendaTasks;
  todayISO: string;
  colorOf: (category: string) => string;
}

const weekdayOf = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// A task's dot color: its goal's color if tagged to a goal, else its category color,
// else a neutral grey (Uncategorized).
function taskColor(t: { goal_id: string | null; goal_title: string | null; goal_color: string | null; category: string | null }, colorOf: (c: string) => string): string {
  if (t.goal_id && t.goal_title) return goalColor(t.goal_color, t.goal_id);
  if (t.category) return colorOf(t.category);
  return '#9ca3af';
}

// A day bucket's header: "Today"/"Tomorrow" for the near days, else "Wed · Jul 30".
function dayLabel(date: string, todayISO: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const md = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (diff === 0) return `Today · ${md}`;
  if (diff === 1) return `Tomorrow · ${md}`;
  const wd = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${wd} · ${md}`;
}

const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

interface AgendaRow {
  key: string;
  title: string;
  done: boolean;
  recurring: boolean;
  color: string;
}

// An agenda of scheduled tasks grouped by the chart's buckets — a "what's on each day"
// view alongside the time-allocation bars. Recurring tasks are expanded onto the days
// (or months) they fall on; empty buckets are skipped so the list reads like a schedule.
export function TaskAgenda({ buckets, granularity, tasks, todayISO, colorOf }: TaskAgendaProps) {
  const groups = buckets
    .map((bucket) => {
      let rows: AgendaRow[];
      if (granularity === 'day') {
        const wd = weekdayOf(bucket);
        const recurring: AgendaRow[] = tasks.recurring
          .filter((r) => (r.days_mask & (1 << wd)) !== 0 && r.since <= bucket)
          .map((r) => ({
            key: `${bucket}-${r.id}`,
            title: r.title,
            done: tasks.completions.some((c) => c.recurring_todo_id === r.id && c.date === bucket),
            recurring: true,
            color: taskColor(r, colorOf),
          }));
        const oneOff: AgendaRow[] = tasks.data
          .filter((t) => t.date === bucket)
          .map((t) => ({ key: `${bucket}-${t.id}`, title: t.title, done: t.done, recurring: false, color: taskColor(t, colorOf) }));
        rows = [...oneOff, ...recurring];
      } else {
        // Year view: group by month. One-off tasks fall in their date's month; recurring
        // tasks (which repeat weekly) are listed once per month they're active in.
        const ym = bucket.slice(0, 7);
        const lastDay = `${ym}-31`;
        const oneOff: AgendaRow[] = tasks.data
          .filter((t) => t.date.slice(0, 7) === ym)
          .map((t) => ({ key: `${bucket}-${t.id}`, title: t.title, done: t.done, recurring: false, color: taskColor(t, colorOf) }));
        const recurring: AgendaRow[] = tasks.recurring
          .filter((r) => r.since <= lastDay)
          .map((r) => ({ key: `${bucket}-${r.id}`, title: r.title, done: false, recurring: true, color: taskColor(r, colorOf) }));
        rows = [...oneOff, ...recurring];
      }
      // Incomplete first, so what's left to do reads at the top of each bucket.
      rows.sort((a, b) => Number(a.done) - Number(b.done));
      return { bucket, label: granularity === 'day' ? dayLabel(bucket, todayISO) : monthLabel(bucket), rows };
    })
    .filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">No tasks scheduled.</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-4">
      {groups.map((g) => (
        <div key={g.bucket}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{g.label}</p>
          <ul className="space-y-1">
            {g.rows.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5 text-sm">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                <span className={`truncate ${r.done ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-700 dark:text-neutral-200'}`}>
                  {r.title}
                </span>
                {r.recurring && (
                  <span className="text-neutral-300 dark:text-neutral-600 text-xs flex-shrink-0" title="Recurring task">
                    ↻
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
