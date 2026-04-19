'use client';

import { useState, useEffect } from 'react';
import { MetricCard } from '../components/metric-card';
import { WindowSelector } from '../components/window-selector';
import { TrendChart } from '../components/trend-chart';
import { ActivityFeed } from '../components/activity-feed';
import { ContributionHeatmap } from '../components/contribution-heatmap';
import { ConsistencyScore } from '../components/consistency-score';
import { apiFetch } from '../../lib/api';

type Window = '7d' | '30d' | '90d';
type MetricKey = 'focus_hours' | 'cycle_time' | 'active_days';

interface MetricValue {
  value: number | null;
  delta: number | null;
  unit: string;
}

interface OverviewResponse {
  window: string;
  metrics: Record<string, MetricValue>;
  patterns: {
    day_of_week: Array<{ day: string; count: number }>;
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

const HERO_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'focus_hours', label: 'Focus hours' },
  { key: 'cycle_time', label: 'Cycle time' },
  { key: 'active_days', label: 'Active days' },
];

const METRIC_LABELS: Record<string, string> = {};
HERO_METRICS.forEach((m) => (METRIC_LABELS[m.key] = m.label));

export default function Overview() {
  const [window, setWindow] = useState<Window>('30d');
  const [activeMetric, setActiveMetric] = useState<MetricKey>('focus_hours');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [heatmapData, setHeatmapData] = useState<Array<{ date: string; value: number }>>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<OverviewResponse>(`/v1/metrics/overview?window=${window}`),
      apiFetch<TimeseriesResponse>(
        `/v1/metrics/timeseries?metric=${activeMetric}&window=${window}&bucket=day`,
      ),
      apiFetch<TimeseriesResponse>(
        `/v1/metrics/timeseries?metric=commits&window=${window}&bucket=day`,
      ),
      apiFetch<{ data: EventItem[] }>('/v1/events?limit=50'),
    ])
      .then(([ov, ts, hm, ev]) => {
        setOverview(ov);
        setTimeseries(ts);
        setHeatmapData(hm.data);
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <WindowSelector value={window} onChange={setWindow} />
      </div>

      {/* Consistency score */}
      <div className="mb-6">
        <ConsistencyScore
          activeDays={overview?.metrics.active_days?.value ?? null}
          totalDays={window === '7d' ? 7 : window === '90d' ? 90 : 30}
          delta={overview?.metrics.active_days?.delta ?? null}
          window={window}
        />
      </div>

      {/* 3 hero metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {HERO_METRICS.map((m) => {
          const metric = overview?.metrics[m.key];
          return (
            <MetricCard
              key={m.key}
              label={m.label}
              value={metric?.value ?? null}
              delta={metric?.delta ?? null}
              unit={metric?.unit || ''}
              window={window}
              active={activeMetric === m.key}
              onClick={() => setActiveMetric(m.key)}
            />
          );
        })}
      </div>

      {/* Trend chart */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <p className="text-xs text-neutral-500 mb-4">
          {METRIC_LABELS[activeMetric] || activeMetric} — {window}
        </p>
        <TrendChart
          data={timeseries?.data || []}
          unit={overview?.metrics[activeMetric]?.unit || ''}
        />
      </div>

      {/* 3-tab panel — responds to window */}
      <div className="mb-6">
        <ContributionHeatmap
          data={heatmapData}
          events={events}
          overviewMetrics={overview?.metrics}
          window={window}
        />
      </div>

      {/* Recent activity */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-6">
        <p className="text-xs text-neutral-500 mb-3">Recent activity</p>
        <div className="max-h-80 overflow-y-auto scrollbar-hide">
          <ActivityFeed events={events.slice(0, 20)} />
        </div>
      </div>
    </div>
  );
}
