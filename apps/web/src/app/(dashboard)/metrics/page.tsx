'use client';

import { useState, useEffect } from 'react';
import { PeriodSelector, periodRangeLabel, type Period } from '../../components/period-selector';
import { MetricBarChart } from '../../components/metric-bar-chart';
import { ConsistencyScore } from '../../components/consistency-score';
import { MetricsStrip, type StripStat } from '../../components/metrics-strip';
import { DayDetailsModal } from '../../components/day-details-modal';
import { apiFetch } from '../../../lib/api';

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

// Curated GitHub-derived metrics. `tab` is the Activity Details tab a bar opens to.
const METRICS: Array<{ key: string; metric: string; label: string; unit: string; tab?: string; sub?: 'elapsed' }> = [
  { key: 'commits', metric: 'commits', label: 'Commits', unit: 'commits', tab: 'commits' },
  { key: 'throughput', metric: 'throughput', label: 'PRs Merged', unit: 'PRs', tab: 'prs' },
  { key: 'reviews', metric: 'reviews', label: 'Reviews', unit: 'reviews', tab: 'reviews' },
  { key: 'active_days', metric: 'active_days', label: 'Active Days', unit: 'days', sub: 'elapsed' },
  { key: 'streak', metric: 'streak', label: 'Best Streak', unit: 'days' },
];

const PERIOD_LABEL: Record<Period, string> = { week: 'this week', month: 'this month', year: 'this year' };

// Days elapsed so far in the current period (UTC), for the consistency denominator.
function elapsedDaysInPeriod(period: Period): number {
  const now = new Date();
  if (period === 'year') {
    const start = Date.UTC(now.getUTCFullYear(), 0, 1);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((today - start) / 86400000) + 1;
  }
  if (period === 'month') return now.getUTCDate();
  return ((now.getUTCDay() + 6) % 7) + 1; // week, Monday-anchored
}

// Event range + title for a clicked bar: a single day, or a whole month (year view).
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
  const [period, setPeriod] = useState<Period>('week');
  const [active, setActive] = useState('commits');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [seriesMap, setSeriesMap] = useState<Record<string, Array<{ date: string; value: number }>>>({});
  const [loading, setLoading] = useState(true);
  const [inspect, setInspect] = useState<{ since: string; until: string; title: string; tab: string } | null>(null);

  // Prefetch the overview + every metric's series (period's natural buckets) in
  // parallel on period change, so switching tiles is instant — no per-click fetch,
  // no lingering/clickable stale bars.
  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<OverviewResponse>(`/v1/metrics/overview?period=${period}`),
      Promise.all(
        METRICS.map((d) =>
          apiFetch<TimeseriesResponse>(`/v1/metrics/timeseries?metric=${d.metric}&period=${period}`).then(
            (r) => [d.key, r.data] as [string, Array<{ date: string; value: number }>],
          ),
        ),
      ),
    ])
      .then(([ov, entries]) => {
        setOverview(ov);
        setSeriesMap(Object.fromEntries(entries));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const m = overview?.metrics;
  const elapsedDays = elapsedDaysInPeriod(period);

  const now = new Date();
  const todayKey =
    period === 'year'
      ? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
      : now.toISOString().split('T')[0];

  const stats: StripStat[] = METRICS.map((d) => ({
    key: d.key,
    label: d.label,
    value: d.key === 'streak' ? `${m?.[d.metric]?.value ?? 0}d` : (m?.[d.metric]?.value ?? 0),
    sub: d.sub === 'elapsed' ? `/ ${elapsedDays}` : undefined,
    delta: m?.[d.metric]?.delta ?? null,
  }));

  const activeDef = METRICS.find((d) => d.key === active)!;

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
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{periodRangeLabel(period)}</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="mb-6">
        <ConsistencyScore
          activeDays={m?.active_days?.value ?? null}
          totalDays={elapsedDays}
          delta={m?.active_days?.delta ?? null}
          window={period}
        />
      </div>

      <div className="mb-6">
        <MetricsStrip stats={stats} activeKey={active} onSelect={setActive} />
      </div>

      <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {activeDef.label} · {PERIOD_LABEL[period]}
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Click a bar for details</p>
        </div>
        <MetricBarChart
          data={seriesMap[active] ?? []}
          unit={activeDef.unit}
          todayISO={todayKey}
          onSelectBar={(date) => setInspect({ ...bucketRange(period, date), tab: activeDef.tab ?? 'commits' })}
        />
      </div>

      {inspect && (
        <DayDetailsModal
          since={inspect.since}
          until={inspect.until}
          title={inspect.title}
          initialCategory={inspect.tab}
          onClose={() => setInspect(null)}
        />
      )}
    </div>
  );
}
