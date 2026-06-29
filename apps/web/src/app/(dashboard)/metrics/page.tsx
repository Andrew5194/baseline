'use client';

import { useState, useEffect } from 'react';
import { PeriodSelector, periodRangeLabel, type Period } from '../../components/period-selector';
import { MetricBarChart } from '../../components/metric-bar-chart';
import { ConsistencyScore } from '../../components/consistency-score';
import { MetricsStrip, type StripStat } from '../../components/metrics-strip';
import { DayDetailsModal } from '../../components/day-details-modal';
import { CalendarDayModal } from '../../components/calendar-day-modal';
import { SourceDropdown } from '../../components/source-dropdown';
import { apiFetch } from '../../../lib/api';
import { useTimezone } from '../../../lib/use-timezone';

interface MetricValue {
  value: number | null;
  delta: number | null;
  unit: string;
}
interface OverviewResponse {
  period: string;
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
];

// Distinct sources that currently have metrics — drives the source filter.
const SOURCES = [...new Set(METRICS.map((m) => m.source))];

// Where each source's overview/timeseries live.
const overviewUrl = (source: string, period: string) =>
  source === 'google_calendar' ? `/v1/metrics/calendar/overview?period=${period}` : `/v1/metrics/overview?period=${period}`;
const timeseriesUrl = (source: string, metric: string, period: string) =>
  source === 'google_calendar'
    ? `/v1/metrics/calendar/timeseries?metric=${metric}&period=${period}`
    : `/v1/metrics/timeseries?metric=${metric}&period=${period}`;

const PERIOD_LABEL: Record<Period, string> = { week: 'this week', month: 'this month', year: 'this year' };

function elapsedDaysInPeriod(period: Period, tz: string): number {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = key.split('-').map(Number);
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
  const [period, setPeriod] = useState<Period>('week');
  const [source, setSource] = useState('github');
  const [active, setActive] = useState('commits');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [seriesMap, setSeriesMap] = useState<Record<string, Array<{ date: string; value: number }>>>({});
  const [loading, setLoading] = useState(true);
  const [inspect, setInspect] = useState<{ since: string; until: string; title: string; tab: string; source: string } | null>(null);

  // Prefetch every source's overview + each metric's series on period change, so
  // switching tiles/sources is instant. Resilient: a source that isn't connected
  // (or errors) just contributes empty data instead of failing the whole load.
  useEffect(() => {
    setLoading(true);
    const empty = { period, metrics: {} as Record<string, MetricValue> };
    Promise.all([
      apiFetch<OverviewResponse>(overviewUrl('github', period)).catch(() => empty),
      apiFetch<OverviewResponse>(overviewUrl('google_calendar', period)).catch(() => empty),
      Promise.all(
        METRICS.map((d) =>
          apiFetch<TimeseriesResponse>(timeseriesUrl(d.source, d.metric, period))
            .then((r) => [d.key, r.data] as [string, Array<{ date: string; value: number }>])
            .catch(() => [d.key, []] as [string, Array<{ date: string; value: number }>]),
        ),
      ),
    ])
      .then(([gh, cal, entries]) => {
        setOverview({ period: gh.period ?? period, metrics: { ...gh.metrics, ...cal.metrics } });
        setSeriesMap(Object.fromEntries(entries));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const m = overview?.metrics;

  const dataPeriod: Period =
    overview?.period === 'week' || overview?.period === 'month' || overview?.period === 'year' ? overview.period : period;
  const elapsedDays = elapsedDaysInPeriod(dataPeriod, tz);

  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todayKey = dataPeriod === 'year' ? `${todayLocal.slice(0, 7)}-01` : todayLocal;

  const visibleMetrics = source === 'all' ? METRICS : METRICS.filter((d) => d.source === source);

  // The consistency card tracks the active-days-style metric for the current view:
  // busy days for calendar, active days otherwise (incl. the combined "all" view).
  const consistencyDef =
    source === 'google_calendar' ? METRICS.find((d) => d.key === 'busy_days') : METRICS.find((d) => d.key === 'active_days');
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

  if (loading && !overview) {
    return (
      <div className="p-8 max-w-5xl space-y-6">
        <div className="h-8 w-40 bg-neutral-200 dark:bg-neutral-800 rounded shimmer" />
        <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
        <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{periodRangeLabel(period, tz)}</p>
        </div>
        <div className="flex items-center gap-3">
          <SourceDropdown value={source} onChange={changeSource} sources={SOURCES} />
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {showConsistency && consistencyDef && (
        <div className="mb-6">
          <ConsistencyScore
            activeDays={m?.[consistencyDef.metric]?.value ?? null}
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
            {activeDef.label} · {PERIOD_LABEL[dataPeriod]}
          </p>
        </div>
        <MetricBarChart
          data={seriesMap[active] ?? []}
          unit={activeDef.unit}
          todayISO={todayKey}
          onSelectBar={(date) => setInspect({ ...bucketRange(dataPeriod, date), tab: activeDef.tab ?? 'commits', source: activeDef.source })}
        />
      </div>

      {inspect && inspect.source === 'google_calendar' ? (
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
