'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { colorForCategory } from '../../lib/categories';
import { type TimeUnit, fmtDuration } from '../../lib/time-units';
import { Modal } from './modal';

interface CalEntry {
  occurred_at: string;
  hours: number;
  category: string;
  note?: string | null;
}

interface CalendarAllocationProps {
  // Same rows as the bar chart: { date, [category]: hours, Free }.
  data: Array<Record<string, number | string>>;
  categories: string[];
  colorOf?: (c: string) => string;
  // 'month' = year view (one cell per month); 'day' = week/month view.
  granularity: 'day' | 'month';
  recurringCategories?: string[];
  freeFocus?: boolean;
  todayISO?: string;
  // Individual time entries (with real times) — drives the week hour-grid.
  entries?: CalEntry[];
  tz: string;
  // A live, unsaved timer session — drawn as a translucent block growing to "now".
  pending?: { date: string; category: string; hours: number; running: boolean } | null;
  // Display unit for the hover tooltip's duration.
  unit?: TimeUnit;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_PX = 32;

// Monday-anchored weekday index (0 = Mon … 6 = Sun) for a YYYY-MM-DD date.
const mondayIndex = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

function fmtHour(h: number): string {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// The entry's local calendar day + the hour-of-day (fractional) of its END, in `tz`.
function localEnd(iso: string, tz: string): { date: string; hour: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  let hh = get('hour');
  if (hh === '24') hh = '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(hh) + Number(get('minute')) / 60 };
}

export function CalendarAllocation({
  data,
  colorOf,
  granularity,
  todayISO,
  entries,
  tz,
  pending,
  unit = 'hr',
}: CalendarAllocationProps) {
  const color = colorOf ?? ((c: string) => colorForCategory(c));
  const [hover, setHover] = useState<{ cat: string; hours: number; range: string; note?: string | null; color: string; x: number; y: number } | null>(null);
  // "+N more" → show every event for that day/month in a modal.
  const [expanded, setExpanded] = useState<{ title: string; events: CalEntry[] } | null>(null);
  // Live "current time" line — set after mount (no SSR clock → no hydration clash).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const isYear = granularity === 'month';

  const dates = useMemo(() => data.map((r) => String(r.date)).sort(), [data]);
  const isWeek = !isYear && dates.length <= 7;

  // Events grouped by local day and month (newest-first) for the month/year views.
  // Memoized so the per-second pending tick doesn't re-run localEnd() for every entry.
  const { eventsByDate, eventsByMonth } = useMemo(() => {
    const sorted = (entries ?? []).slice().sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
    const byDate = new Map<string, CalEntry[]>();
    const byMonth = new Map<string, CalEntry[]>();
    for (const e of sorted) {
      const d = localEnd(e.occurred_at, tz).date;
      (byDate.get(d) ?? byDate.set(d, []).get(d)!).push(e);
      const ym = d.slice(0, 7);
      (byMonth.get(ym) ?? byMonth.set(ym, []).get(ym)!).push(e);
    }
    return { eventsByDate: byDate, eventsByMonth: byMonth };
  }, [entries, tz]);

  // Week grid: each entry as a start→end block on the local day it ends. Top-level memo
  // (a hook can't live in the isWeek branch) so the pending tick doesn't re-loop; empty
  // map for non-week shapes.
  const blocksByDate = useMemo(() => {
    const map = new Map<string, Array<{ top: number; height: number; tiny: boolean; cat: string; hours: number; note?: string | null; range: string }>>();
    if (isYear || dates.length === 0 || dates.length > 7) return map;
    const LABEL_MIN = HOUR_PX * 0.5; // below this a block is too short to fit a label
    for (const d of dates) map.set(d, []);
    for (const e of entries ?? []) {
      if (!(e.hours > 0)) continue;
      const { date, hour } = localEnd(e.occurred_at, tz);
      const bucket = map.get(date);
      if (!bucket) continue; // outside this week
      const start = Math.max(0, hour - e.hours);
      const top = start * HOUR_PX;
      // Draw to true scale (duration × px/hr); just keep a 1px sliver so it's visible.
      const height = Math.max(1, (hour - start) * HOUR_PX);
      const tiny = height < LABEL_MIN; // too short to fit a label
      const fmt = (h: number) => {
        const hh = Math.floor(h) % 24;
        const mm = Math.round((h - Math.floor(h)) * 60);
        const ampm = hh < 12 ? 'AM' : 'PM';
        const h12 = hh % 12 === 0 ? 12 : hh % 12;
        return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
      };
      bucket.push({ top, height, tiny, cat: e.category, hours: e.hours, note: e.note, range: `${fmt(start)} – ${fmt(hour)}` });
    }
    return map;
  }, [entries, tz, dates, isYear]);

  const CAP = 3; // events shown per cell before "+N more"
  // The event's start–end time (optionally prefixed with its date) for the tooltip.
  const eventRange = (e: CalEntry, withDate: boolean) => {
    const end = new Date(e.occurred_at);
    const start = new Date(end.getTime() - e.hours * 3_600_000);
    const t = (dd: Date) => dd.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    const datePart = withDate ? `${end.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })} · ` : '';
    return `${datePart}${t(start)} – ${t(end)}`;
  };
  const showTip = (e: CalEntry, ev: { clientX: number; clientY: number }, withDate: boolean) =>
    setHover({ cat: e.category, hours: e.hours, range: eventRange(e, withDate), note: e.note, color: color(e.category), x: ev.clientX, y: ev.clientY });

  // Styled hover tooltip (shared by every view), rendered to <body> so it isn't clipped.
  const tooltipNode =
    hover &&
    createPortal(
      <div
        style={{ position: 'fixed', top: hover.y + 14, left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 236), zIndex: 60 }}
        className="pointer-events-none max-w-[220px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-2 font-medium text-neutral-900 dark:text-white">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: hover.color }} />
          <span className="truncate">{hover.cat}</span>
        </div>
        <div className="text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
          {hover.range} · {fmtDuration(hover.hours, unit)}
        </div>
        {hover.note && <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">{hover.note}</div>}
      </div>,
      document.body,
    );

  // "+N more" modal listing every event for the chosen day/month.
  const modalNode = expanded && (
    <Modal onClose={() => setExpanded(null)}>
      <div className="w-[440px] max-w-full p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{expanded.title}</h2>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{expanded.events.length} event{expanded.events.length === 1 ? '' : 's'}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 divide-y divide-neutral-100 dark:divide-neutral-800">
          {expanded.events.map((e, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color(e.category) }} />
              <span className="text-neutral-800 dark:text-neutral-200 truncate flex-1">{e.note || e.category}</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums flex-shrink-0">{eventRange(e, true)}</span>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 tabular-nums w-12 text-right flex-shrink-0">{fmtDuration(e.hours, unit)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );

  // ── Week: Google-Calendar-style hour grid (12 AM → 12 AM) ──────────────────
  if (isWeek && dates.length > 0) {
    // Bucketed entry blocks come from the memoized `blocksByDate` above.
    // "Current time" line, shown only when today is within the displayed week.
    const nowPos = now ? localEnd(now.toISOString(), tz) : null;
    const showNow = !!nowPos && dates.includes(nowPos.date);
    const nowTop = nowPos ? nowPos.hour * HOUR_PX : 0;
    const nowCol = nowPos ? dates.indexOf(nowPos.date) : -1;

    return (
      <div>
        {/* Day headers */}
        <div className="flex">
          <div className="w-12 flex-shrink-0" />
          <div className="flex-1 grid grid-cols-7">
            {dates.map((date) => {
              const today = todayISO === date;
              return (
                <div key={date} className="text-center pb-1.5">
                  <div className={`text-[10px] font-medium ${today ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {weekdayOf(date)}
                  </div>
                  <div className={`text-xs tabular-nums ${today ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-300'}`}>
                    {Number(date.split('-')[2])}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable hour grid */}
        <div className="max-h-[520px] overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex" style={{ height: 24 * HOUR_PX }}>
            {/* Hour labels */}
            <div className="w-12 flex-shrink-0 relative">
              {/* Label each hour line (Google-style): the midnight edges stay unlabeled
                  so the slots line up without bookending "12 AM – 12 AM". */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-1.5 text-[9px] text-neutral-400 dark:text-neutral-500 tabular-nums -translate-y-1/2"
                  style={{ top: h * HOUR_PX }}
                >
                  {h === 0 ? '' : fmtHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="flex-1 grid grid-cols-7 relative">
              {dates.map((date) => {
                const today = todayISO === date;
                return (
                  <div key={date} className={`relative border-l border-neutral-100 dark:border-neutral-800 ${today ? 'bg-emerald-500/[0.04]' : ''}`}>
                    {/* Hour gridlines */}
                    {HOURS.map((h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-neutral-100 dark:border-neutral-800/70" style={{ top: h * HOUR_PX }} />
                    ))}
                    {/* Entry blocks */}
                    {(blocksByDate.get(date) ?? []).map((b, i) => (
                      <div
                        key={i}
                        className={`absolute left-0.5 right-0.5 rounded overflow-hidden text-white shadow-sm cursor-default ${b.tiny ? '' : 'px-1 py-0.5 text-[9px] leading-tight'}`}
                        style={{ top: b.top, height: b.height, backgroundColor: color(b.cat) }}
                        onMouseMove={(ev) => setHover({ cat: b.cat, hours: b.hours, range: b.range, note: b.note, color: color(b.cat), x: ev.clientX, y: ev.clientY })}
                        onMouseLeave={() => setHover(null)}
                      >
                        {!b.tiny && (
                          <>
                            <div className="font-medium truncate">{b.cat}</div>
                            {b.height > HOUR_PX && <div className="truncate opacity-80">{b.range}</div>}
                          </>
                        )}
                      </div>
                    ))}
                    {/* Live timer session — translucent block growing up to "now". */}
                    {pending && nowPos && date === pending.date && (() => {
                      const start = Math.max(0, nowPos.hour - pending.hours);
                      const top = start * HOUR_PX;
                      const height = (nowPos.hour - start) * HOUR_PX;
                      if (height <= 0) return null;
                      return (
                        <div
                          className="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded overflow-hidden border border-dashed border-white/70"
                          style={{ top, height, backgroundColor: color(pending.category), opacity: 0.5 }}
                        >
                          {height > HOUR_PX && <div className="px-1 py-0.5 text-[9px] font-medium text-white truncate">{pending.category}</div>}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {/* Current-time line — only across today's column. */}
              {showNow && nowCol >= 0 && (
                <div
                  className="pointer-events-none absolute z-20"
                  style={{ top: nowTop, left: `${(nowCol / 7) * 100}%`, width: `${100 / 7}%` }}
                >
                  <div className="h-[2px] bg-red-500/90" />
                  <span className="absolute left-0 w-2.5 h-2.5 rounded-full bg-red-500 -translate-x-1/2 -translate-y-1/2" style={{ top: 1 }} />
                </div>
              )}
            </div>
          </div>
        </div>
        {tooltipNode}
      </div>
    );
  }

  // ── Year: one card per month, listing that month's events (newest first) ──────
  if (isYear) {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((r) => {
            const date = String(r.date); // YYYY-MM-01
            const [, m] = date.split('-').map(Number);
            const evs = eventsByMonth.get(date.slice(0, 7)) ?? [];
            const current = todayISO === date;
            return (
              <div
                key={date}
                className={`rounded-lg border p-3 ${current ? 'border-emerald-400 dark:border-emerald-500/50' : 'border-neutral-200 dark:border-neutral-800'}`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <p className={`text-sm font-semibold ${current ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-200'}`}>{MONTHS[m - 1]}</p>
                  {evs.length > 0 && <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{evs.length} event{evs.length === 1 ? '' : 's'}</span>}
                </div>
                {evs.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">No events</p>
                ) : (
                  <div className="space-y-1">
                    {evs.slice(0, CAP).map((e, i) => {
                      const c = color(e.category);
                      const day = Number(localEnd(e.occurred_at, tz).date.slice(8));
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-[11px] cursor-default"
                          onMouseMove={(ev) => showTip(e, ev, true)}
                          onMouseLeave={() => setHover(null)}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                          <span className="w-5 text-right tabular-nums text-neutral-400 dark:text-neutral-500 flex-shrink-0">{day}</span>
                          <span className="truncate text-neutral-700 dark:text-neutral-300">{e.note || e.category}</span>
                        </div>
                      );
                    })}
                    {evs.length > CAP && (
                      <button
                        onClick={() => setExpanded({ title: `${MONTHS[m - 1]} ${date.slice(0, 4)}`, events: evs })}
                        className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline pl-3"
                      >
                        +{evs.length - CAP} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {tooltipNode}
        {modalNode}
      </>
    );
  }

  // ── Month: a calendar grid with each day's events as chips (newest first) ─────
  const lead = dates.length ? mondayIndex(dates[0]) : 0;
  const dayTitle = (date: string) => {
    const [yy, mm, dd] = date.split('-').map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  };

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 text-center">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {dates.map((date) => {
          const d = Number(date.split('-')[2]);
          const today = todayISO === date;
          const evs = eventsByDate.get(date) ?? [];
          return (
            <div
              key={date}
              className={`rounded-lg border p-1.5 flex flex-col gap-1 min-h-[92px] ${
                today ? 'border-emerald-400 dark:border-emerald-500/50' : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <span className={`text-[11px] tabular-nums ${today ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {d}
              </span>
              <div className="space-y-0.5">
                {evs.slice(0, CAP).map((e, i) => {
                  const c = color(e.category);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] leading-tight cursor-default"
                      style={{ backgroundColor: `${c}22` }}
                      onMouseMove={(ev) => showTip(e, ev, false)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                      <span className="truncate" style={{ color: c }}>{e.note || e.category}</span>
                    </div>
                  );
                })}
                {evs.length > CAP && (
                  <button
                    onClick={() => setExpanded({ title: dayTitle(date), events: evs })}
                    className="block text-[9px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline pl-1"
                  >
                    +{evs.length - CAP} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {tooltipNode}
      {modalNode}
    </>
  );
}
