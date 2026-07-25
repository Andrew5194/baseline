'use client';

import { Modal } from './modal';
import { type TimeUnit, fmtDuration } from '../../lib/time-units';

export interface CategoryEntry {
  id: string;
  occurred_at: string;
  hours: number;
  note: string | null;
  timed?: boolean;
  task_id?: string | null;
  source?: string;
  link?: string | null;
}

// Each entry's origin — the sources that make up a category's logged time. The badge is
// tinted with the category's own color (passed in), so it matches the donut/legend.
function entryKind(e: CategoryEntry): string {
  if (e.source === 'google_calendar') return 'Calendar';
  if (e.task_id) return 'Task';
  if (e.timed) return 'Timer';
  return 'Manual';
}

// Shows where a category's Entries and Time Logged numbers come from: the individual
// logged entries behind them (manual, timer, task, or calendar), plus — for recurring
// routines — the planned allocation the entries alone don't account for.
export function CategoryDetailModal({
  category,
  color,
  entries,
  entryCount,
  hours,
  pct,
  isRecurring,
  tz,
  unit,
  onClose,
}: {
  category: string;
  color: string;
  entries: CategoryEntry[] | null; // null while loading
  entryCount: number;
  hours: number;
  pct: number;
  isRecurring: boolean;
  tz: string;
  unit: TimeUnit;
  onClose: () => void;
}) {
  const sorted = (entries ?? []).slice().sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
  const loggedFromEntries = Math.round(sorted.reduce((s, e) => s + e.hours, 0) * 10) / 10;
  // Any gap between the table's hours and the logged entries is the recurring-routine
  // allocation folded into the budget — surface it so the numbers reconcile.
  const allocationHours = entries ? Math.round(Math.max(hours - loggedFromEntries, 0) * 10) / 10 : 0;

  const when = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const stats: Array<[string, string]> = [
    ['Entries', String(entryCount)],
    ['Time Logged', fmtDuration(hours, unit)],
    ['% Total', `${pct}%`],
  ];

  return (
    <Modal onClose={onClose}>
      <div className="w-[460px] max-w-full p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <h2 className="flex-1 text-base font-semibold tracking-tight text-neutral-900 dark:text-white truncate">{category}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 -mr-1 p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Where this category&apos;s numbers come from.</p>

        {/* The same three figures shown in the This-week table. */}
        <div className="flex items-center gap-8 pb-4 mb-4 border-b border-neutral-100 dark:border-neutral-800">
          {stats.map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        {entries === null ? (
          <div className="space-y-2 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-md shimmer" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-2">
            {isRecurring
              ? 'No individual entries — this time comes entirely from a recurring routine allocation.'
              : 'No entries in this period.'}
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((e) => {
              const kind = entryKind(e);
              const inner = (
                <>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0" style={{ backgroundColor: `${color}22`, color }}>{kind}</span>
                  <span className="text-neutral-500 dark:text-neutral-400 tabular-nums text-[11px] w-28 flex-shrink-0">{when(e.occurred_at)}</span>
                  <span className="flex-1 min-w-0 flex items-center gap-1 text-neutral-700 dark:text-neutral-300">
                    <span className="truncate">{e.note || '—'}</span>
                    {e.link && (
                      <svg className="w-3 h-3 flex-shrink-0 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </span>
                  <span className="text-neutral-900 dark:text-white font-medium tabular-nums flex-shrink-0">{fmtDuration(e.hours, unit)}</span>
                </>
              );
              return e.link ? (
                <a
                  key={e.id}
                  href={e.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Google Calendar"
                  className="group flex items-center gap-2.5 py-2 text-sm -mx-1 px-1 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  {inner}
                </a>
              ) : (
                <div key={e.id} className="flex items-center gap-2.5 py-2 text-sm">
                  {inner}
                </div>
              );
            })}
          </div>
        )}

        {allocationHours > 0 && (
          <p className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[12px] text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">{fmtDuration(loggedFromEntries, unit)}</span> logged from entries
            {' + '}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">{fmtDuration(allocationHours, unit)}</span> from the recurring routine
            {' = '}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">{fmtDuration(hours, unit)}</span>.
          </p>
        )}
      </div>
    </Modal>
  );
}
