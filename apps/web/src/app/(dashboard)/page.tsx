'use client';

import { useState, useEffect } from 'react';
import { MetricCard } from '../components/metric-card';
import { WindowSelector } from '../components/window-selector';
import { TrendChart } from '../components/trend-chart';
import { ActivityFeed } from '../components/activity-feed';
import { apiFetch } from '../../lib/api';

type Window = '7d' | '30d' | '90d';
type MetricKey = 'focus_hours' | 'cycle_time' | 'throughput' | 'commits' | 'lines_changed' | 'active_days' | 'deep_work_days' | 'avg_pr_size' | 'reviews' | 'review_ratio' | 'consistency' | 'streak';

interface MetricValue {
  value: number | null;
  delta: number | null;
  unit: string;
}

interface DayOfWeek {
  day: string;
  count: number;
}

interface OverviewResponse {
  window: string;
  metrics: Record<string, MetricValue>;
  patterns: {
    day_of_week: DayOfWeek[];
    peak_day: string | null;
  };
}

interface TimeseriesResponse {
  data: Array<{ date: string; value: number }>;
}

interface EventItem {
  id: string;
  source: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
}

const OUTPUT_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'focus_hours', label: 'Focus hours' },
  { key: 'commits', label: 'Commits' },
  { key: 'throughput', label: 'PRs merged' },
  { key: 'lines_changed', label: 'Lines changed' },
  { key: 'active_days', label: 'Active days' },
  { key: 'deep_work_days', label: 'Deep work days' },
];

const VELOCITY_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'cycle_time', label: 'Cycle time' },
  { key: 'avg_pr_size', label: 'Avg PR size' },
  { key: 'reviews', label: 'Reviews given' },
  { key: 'review_ratio', label: 'Review ratio' },
];

const CALIBRATION_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'consistency', label: 'Consistency' },
  { key: 'streak', label: 'Best streak' },
];

const ALL_METRIC_LABELS: Record<string, string> = {};
[...OUTPUT_METRICS, ...VELOCITY_METRICS, ...CALIBRATION_METRICS].forEach(
  (m) => (ALL_METRIC_LABELS[m.key] = m.label),
);

export default function Overview() {
  const [window, setWindow] = useState<Window>('30d');
  const [activeMetric, setActiveMetric] = useState<MetricKey>('focus_hours');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<OverviewResponse>(`/v1/metrics/overview?window=${window}`),
      apiFetch<TimeseriesResponse>(`/v1/metrics/timeseries?metric=${activeMetric}&window=${window}&bucket=day`),
      apiFetch<{ data: EventItem[] }>('/v1/events?limit=20'),
    ])
      .then(([ov, ts, ev]) => {
        setOverview(ov);
        setTimeseries(ts);
        setEvents(ev.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [window, activeMetric]);

  if (loading && !overview) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const renderSection = (
    title: string,
    subtitle: string,
    metrics: { key: MetricKey; label: string }[],
  ) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</p>
        <p className="text-xs text-neutral-300 dark:text-neutral-600">— {subtitle}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const metric = overview?.metrics[m.key];
          return (
            <MetricCard
              key={m.key}
              label={m.label}
              value={metric?.value ?? null}
              delta={metric?.delta ?? null}
              unit={metric?.unit || ''}
              active={activeMetric === m.key}
              onClick={() => setActiveMetric(m.key)}
            />
          );
        })}
      </div>
    </div>
  );

  const maxDow = Math.max(
    ...(overview?.patterns.day_of_week.map((d) => d.count) || [1]),
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <WindowSelector value={window} onChange={setWindow} />
      </div>

      {renderSection('Output', 'What you shipped', OUTPUT_METRICS)}
      {renderSection('Velocity', 'How fast you move', VELOCITY_METRICS)}
      {renderSection('Calibration', 'Whether you\'re improving', CALIBRATION_METRICS)}

      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <p className="text-xs text-neutral-500 mb-4">
          {ALL_METRIC_LABELS[activeMetric] || activeMetric} — {window}
        </p>
        <TrendChart
          data={timeseries?.data || []}
          unit={overview?.metrics[activeMetric]?.unit || ''}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-neutral-500">Day of week patterns</p>
            {overview?.patterns.peak_day && (
              <p className="text-xs text-emerald-600">
                Peak: {overview.patterns.peak_day}
              </p>
            )}
          </div>
          <div className="flex items-end gap-2 h-24">
            {overview?.patterns.day_of_week.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-emerald-500/20 relative"
                  style={{
                    height: maxDow > 0 ? `${(d.count / maxDow) * 100}%` : '0%',
                    minHeight: d.count > 0 ? 4 : 0,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-sm bg-emerald-500"
                    style={{ opacity: d.count > 0 ? 0.6 : 0 }}
                  />
                </div>
                <span className="text-[10px] text-neutral-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 mb-3">Recent activity</p>
          <div className="max-h-32 overflow-y-auto">
            <ActivityFeed events={events.slice(0, 8)} />
          </div>
        </div>
      </div>
    </div>
  );
}
