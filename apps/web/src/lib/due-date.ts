// Helpers for a goal's optional target/expiration date (a YYYY-MM-DD local day key).

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whole-day difference (b − a) between two YYYY-MM-DD keys, computed in UTC so DST
// transitions can't skew it.
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function fmtDue(dueAt: string): string {
  const [y, m, d] = dueAt.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal';

export interface DueMeta {
  label: string;
  tone: DueTone;
}

// Short relative label + severity for a goal's due date. `done` keeps completed goals
// from reading as overdue; `countdown` shows time remaining ("7 more days") vs a fixed
// date. Returns null when there's no due date.
export function dueMeta(dueAt: string | null | undefined, done = false, countdown = false): DueMeta | null {
  if (!dueAt) return null;
  const date = fmtDue(dueAt);
  if (done) return { label: `Due ${date}`, tone: 'normal' };
  const diff = daysBetween(todayKey(), dueAt);
  if (countdown) {
    if (diff < 0) {
      const n = -diff;
      return { label: `Overdue by ${n} day${n === 1 ? '' : 's'}`, tone: 'overdue' };
    }
    if (diff === 0) return { label: 'Due today', tone: 'today' };
    return { label: `${diff} more day${diff === 1 ? '' : 's'}`, tone: diff <= 7 ? 'soon' : 'normal' };
  }
  if (diff < 0) return { label: `Overdue · ${date}`, tone: 'overdue' };
  if (diff === 0) return { label: 'Due today', tone: 'today' };
  if (diff === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (diff <= 7) return { label: `Due in ${diff} days`, tone: 'soon' };
  return { label: `Due ${date}`, tone: 'normal' };
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400',
  today: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  soon: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  normal: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
};
