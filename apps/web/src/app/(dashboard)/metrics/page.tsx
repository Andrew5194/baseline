'use client';

import { useState, useEffect } from 'react';
import { PeriodSelector, PeriodNav, periodRangeLabel, type Period } from '../../components/period-selector';
import { MetricBarChart } from '../../components/metric-bar-chart';
import { ConsistencyScore } from '../../components/consistency-score';
import { MetricsStrip, type StripStat } from '../../components/metrics-strip';
import { DayDetailsModal } from '../../components/day-details-modal';
import { CalendarDayModal } from '../../components/calendar-day-modal';
import { SourceDropdown } from '../../components/source-dropdown';
import { BaselineDayModal } from '../../components/baseline-day-modal';
import { apiFetch } from '../../../lib/api';
import { useTimezone } from '../../../lib/use-timezone';
import { useTimeUnit } from '../../../lib/use-time-unit';

interface MetricValue {
  value: number | null;
  delta: number | null;
  prev?: number | null; // the same metric over the matching elapsed slice of the prior period
  unit: string;
  expected?: number; // all-time per-bucket baseline (Baseline source only)
  expectedTotal?: number; // numerator behind the baseline (e.g. total tasks ever)
  expectedBuckets?: number; // denominator behind the baseline (days or months)
}
interface OverviewResponse {
  period: string;
  since?: string; // account-creation day the Baseline average is measured from
  metrics: Record<string, MetricValue>;
}
interface TimeseriesResponse {
  data: Array<{ date: string; value: number }>;
}

// Every metric, tagged with its source. The source filter is derived from these, so
// adding a new integration's metrics here automatically surfaces it in the dropdown.
// `tab` is the GitHub Activity Details tab a bar opens; `suffix` formats the tile
// value; `days` marks the active-days-style metric that drives the consistency card.
const METRICS: Array<{
  key: string;
  metric: string;
  label: string;
  unit: string;
  source: string;
  tab?: string;
  sub?: 'elapsed';
  suffix?: string;
  days?: boolean;
}> = [
  { key: 'commits', metric: 'commits', label: 'Commits', unit: 'commits', source: 'github', tab: 'commits' },
  { key: 'throughput', metric: 'throughput', label: 'PRs Merged', unit: 'PRs', source: 'github', tab: 'prs' },
  { key: 'reviews', metric: 'reviews', label: 'Reviews', unit: 'reviews', source: 'github', tab: 'reviews' },
  { key: 'active_days', metric: 'active_days', label: 'Active Days', unit: 'days', source: 'github', sub: 'elapsed', days: true },
  { key: 'streak', metric: 'streak', label: 'Best Streak', unit: 'days', source: 'github', suffix: 'd' },
  { key: 'meeting_hours', metric: 'meeting_hours', label: 'Meeting Hours', unit: 'hrs', source: 'google_calendar', suffix: 'h' },
  { key: 'events', metric: 'events', label: 'Events', unit: 'events', source: 'google_calendar' },
  { key: 'avg_length', metric: 'avg_length', label: 'Avg Length', unit: 'min', source: 'google_calendar', suffix: 'm' },
  { key: 'busy_days', metric: 'busy_days', label: 'Busy Days', unit: 'days', source: 'google_calendar', sub: 'elapsed', days: true },
  { key: 'tasks_completed', metric: 'tasks_completed', label: 'Tasks Completed', unit: 'tasks', source: 'baseline' },
  { key: 'goals_completed', metric: 'goals_completed', label: 'Goals Completed', unit: 'goals', source: 'baseline' },
  { key: 'hours_tracked', metric: 'hours_tracked', label: 'Hours Tracked', unit: 'hrs', source: 'baseline', suffix: 'h' },
  { key: 'tracked_days', metric: 'tracked_days', label: 'Tracked Days', unit: 'days', source: 'baseline', sub: 'elapsed', days: true },
];

// Distinct sources that currently have metrics — drives the source filter. Baseline
// leads (it's the default), then the connected integrations.
const SOURCES = [...new Set(['baseline', ...METRICS.map((m) => m.source)])];

// Where each source's overview/timeseries live.
const SOURCE_BASE: Record<string, string> = { google_calendar: '/v1/metrics/calendar', baseline: '/v1/metrics/baseline' };
const overviewUrl = (source: string, period: string, offset: number) =>
  `${SOURCE_BASE[source] ?? '/v1/metrics'}/overview?period=${period}&offset=${offset}`;
const timeseriesUrl = (source: string, metric: string, period: string, offset: number) =>
  `${SOURCE_BASE[source] ?? '/v1/metrics'}/timeseries?metric=${metric}&period=${period}&offset=${offset}`;

const PERIOD_LABEL: Record<Period, string> = { week: 'this week', month: 'this month', year: 'this year' };

const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

function elapsedDaysInPeriod(period: Period, tz: string, offset: number): number {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = key.split('-').map(Number);
  // A past period is complete — use its full length, not today's elapsed slice.
  if (offset > 0) {
    if (period === 'week') return 7;
    if (period === 'month') {
      const dt = new Date(Date.UTC(y, m - 1 - offset, 1));
      return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    }
    return isLeap(y - offset) ? 366 : 365;
  }
  if (period === 'year') {
    const start = Date.UTC(y, 0, 1);
    const today = Date.UTC(y, m - 1, d);
    return Math.floor((today - start) / 86400000) + 1;
  }
  if (period === 'month') return d;
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ((weekday + 6) % 7) + 1; // week, Monday-anchored
}

function bucketRange(period: Period, date: string): { since: string; until: string; title: string } {
  const [y, mo, d] = date.split('-').map(Number);
  if (period === 'year') {
    const ny = mo === 12 ? y + 1 : y;
    const nm = mo === 12 ? 1 : mo + 1;
    return {
      since: date,
      until: `${ny}-${String(nm).padStart(2, '0')}-01`,
      title: new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  }
  const start = new Date(Date.UTC(y, mo - 1, d));
  return {
    since: date,
    until: new Date(start.getTime() + 86400000).toISOString().split('T')[0],
    title: start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  };
}

export default function Metrics() {
  const tz = useTimezone();
  const [unit] = useTimeUnit();
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0); // periods back from now (0 = current)
  const [source, setSource] = useState('baseline');
  const [active, setActive] = useState('tasks_completed');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [seriesMap, setSeriesMap] = useState<Record<string, Array<{ date: string; value: number }>>>({});
  const [loading, setLoading] = useState(true);
  const [inspect, setInspect] = useState<{ since: string; until: string; title: string; tab: string; source: string; metric?: string; label?: string } | null>(null);

  // Prefetch every source's overview + each metric's series on period change, so
  // switching tiles/sources is instant. Resilient: a source that isn't connected
  // (or errors) just contributes empty data instead of failing the whole load.
  useEffect(() => {
    setLoading(true);
    const empty: OverviewResponse = { period, metrics: {} };
    Promise.all([
      apiFetch<OverviewResponse>(overviewUrl('github', period, offset)).catch(() => empty),
      apiFetch<OverviewResponse>(overviewUrl('google_calendar', period, offset)).catch(() => empty),
      apiFetch<OverviewResponse>(overviewUrl('baseline', period, offset)).catch(() => empty),
      Promise.all(
        METRICS.map((d) =>
          apiFetch<TimeseriesResponse>(timeseriesUrl(d.source, d.metric, period, offset))
            .then((r) => [d.key, r.data] as [string, Array<{ date: string; value: number }>])
            .catch(() => [d.key, []] as [string, Array<{ date: string; value: number }>]),
        ),
      ),
    ])
      .then(([gh, cal, base, entries]) => {
        setOverview({ period: gh.period ?? period, since: base.since, metrics: { ...gh.metrics, ...cal.metrics, ...base.metrics } });
        setSeriesMap(Object.fromEntries(entries));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, offset]);

  const m = overview?.metrics;

  const dataPeriod: Period =
    overview?.period === 'week' || overview?.period === 'month' || overview?.period === 'year' ? overview.period : period;
  const elapsedDays = elapsedDaysInPeriod(dataPeriod, tz, offset);

  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todayKey = dataPeriod === 'year' ? `${todayLocal.slice(0, 7)}-01` : todayLocal;

  const visibleMetrics = source === 'all' ? METRICS : METRICS.filter((d) => d.source === source);

  // The consistency card tracks the active-days-style metric for the current view:
  // busy days for calendar, active days otherwise (incl. the combined "all" view).
  const consistencyDef =
    source === 'google_calendar'
      ? METRICS.find((d) => d.key === 'busy_days')
      : source === 'baseline'
        ? METRICS.find((d) => d.key === 'tracked_days')
        : METRICS.find((d) => d.key === 'active_days');
  const showConsistency = !!consistencyDef && visibleMetrics.some((d) => d.key === consistencyDef.key);

  function changeSource(s: string) {
    setSource(s);
    const vis = s === 'all' ? METRICS : METRICS.filter((d) => d.source === s);
    if (!vis.some((d) => d.key === active)) setActive(vis[0]?.key ?? active);
  }

  const stats: StripStat[] = visibleMetrics.map((d) => {
    const v = m?.[d.metric]?.value ?? 0;
    return {
      key: d.key,
      label: d.label,
      value: d.suffix ? `${v}${d.suffix}` : v,
      sub: d.sub === 'elapsed' ? `/ ${elapsedDays}` : undefined,
      delta: m?.[d.metric]?.delta ?? null,
    };
  });

  const activeDef = (visibleMetrics.find((d) => d.key === active) ?? METRICS.find((d) => d.key === active))!;

  // The all-time baseline line value + its label. Tracked-days reads as a percentage of
  // days tracked (the per-day value is 0/1, so the average is a rate); others read per
  // day or per month depending on the bucket granularity.
  const avgVal = activeDef.source === 'baseline' ? m?.[activeDef.metric]?.expected ?? null : null;
  const exTotal = activeDef.source === 'baseline' ? m?.[activeDef.metric]?.expectedTotal ?? null : null;
  const exBuckets = activeDef.source === 'baseline' ? m?.[activeDef.metric]?.expectedBuckets ?? null : null;
  // Tracked-days % is derived from the raw total ÷ buckets (not the rounded `expected`),
  // so the label and the click-through breakdown always agree.
  const trackedPct = exTotal != null && exBuckets != null && exBuckets > 0 ? Math.round((exTotal / exBuckets) * 100) : null;

  // Tracked-days is a rate: pin the axis to the per-bucket max (1 day / ~31 days a month)
  // and place its line at the exact percentage, so a "13%" line lands at 13% height — not
  // wherever the count-scaled data max happens to fall.
  const isTrackedDays = activeDef.source === 'baseline' && activeDef.metric === 'tracked_days';
  const trackedMax = dataPeriod === 'year' ? 31 : 1;
  const baselineYMax = isTrackedDays ? trackedMax : undefined;
  const baselineLine = isTrackedDays ? (trackedPct != null ? (trackedPct / 100) * trackedMax : null) : avgVal;

  const avgLabel =
    avgVal == null
      ? ''
      : activeDef.metric === 'tracked_days'
        ? `all-time avg ${trackedPct ?? 0}% tracked`
        : `all-time avg / ${dataPeriod === 'year' ? 'month' : 'day'} ${Math.round(avgVal * 10) / 10}`;

  // Plain-English breakdown shown when the baseline line is clicked.
  const sinceLabel = overview?.since ? (() => { const [y, mo, d] = overview.since!.split('-'); return `${mo}/${d}/${y.slice(2)}`; })() : '';
  const sinceClause = sinceLabel ? `since you first started Baseline on ${sinceLabel}` : 'since you first started Baseline';
  const avgInfo =
    avgVal == null || exTotal == null || exBuckets == null
      ? ''
      : activeDef.metric === 'tracked_days'
        ? `${exTotal} day${exTotal === 1 ? '' : 's'} with tracked time ÷ ${exBuckets} day${exBuckets === 1 ? '' : 's'} ${sinceClause} = ${trackedPct}% of days tracked.`
        : `${exTotal} ${activeDef.metric === 'hours_tracked' ? 'hours' : activeDef.metric === 'goals_completed' ? 'goals' : 'tasks'} ÷ ${exBuckets} ${dataPeriod === 'year' ? 'month' : 'day'}${exBuckets === 1 ? '' : 's'} ${sinceClause} = ${Math.round(avgVal * 10) / 10} per ${dataPeriod === 'year' ? 'month' : 'day'}.`;

  if (loading && !overview) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl space-y-6">
        <div className="h-8 w-40 bg-neutral-200 dark:bg-neutral-800 rounded shimmer" />
        <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
        <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{periodRangeLabel(period, tz, offset)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <SourceDropdown value={source} onChange={changeSource} sources={SOURCES} />
          <PeriodSelector
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setOffset(0);
            }}
          />
        </div>
      </div>

      <div className="mb-2">
        <PeriodNav offset={offset} onChange={setOffset} />
      </div>

      {showConsistency && consistencyDef && (
        <div className="mb-6">
          <ConsistencyScore
            activeDays={m?.[consistencyDef.metric]?.value ?? null}
            priorActiveDays={m?.[consistencyDef.metric]?.prev ?? null}
            totalDays={elapsedDays}
            delta={m?.[consistencyDef.metric]?.delta ?? null}
            window={dataPeriod}
          />
        </div>
      )}

      <div className="mb-6">
        <MetricsStrip stats={stats} activeKey={active} onSelect={setActive} />
      </div>

      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {activeDef.label} {PERIOD_LABEL[dataPeriod]}
          </p>
        </div>
        <MetricBarChart
          data={seriesMap[active] ?? []}
          unit={activeDef.unit}
          todayISO={todayKey}
          average={baselineLine}
          averageLabel={avgLabel}
          averageInfo={avgInfo}
          yMax={baselineYMax}
          onSelectBar={(date) =>
            setInspect({ ...bucketRange(dataPeriod, date), tab: activeDef.tab ?? 'commits', source: activeDef.source, metric: activeDef.metric, label: activeDef.label })
          }
        />
      </div>

      {inspect && inspect.source === 'baseline' ? (
        <BaselineDayModal
          metric={inspect.metric!}
          label={inspect.label!}
          since={inspect.since}
          until={inspect.until}
          title={inspect.title}
          unit={unit}
          onClose={() => setInspect(null)}
        />
      ) : inspect && inspect.source === 'google_calendar' ? (
        <CalendarDayModal since={inspect.since} until={inspect.until} title={inspect.title} onClose={() => setInspect(null)} />
      ) : inspect ? (
        <DayDetailsModal
          since={inspect.since}
          until={inspect.until}
          title={inspect.title}
          initialCategory={inspect.tab}
          onClose={() => setInspect(null)}
        />
      ) : null}
    </div>
  );
}
