'use client';

import { useState, useEffect } from 'react';
import { WindowSelector } from '../../components/window-selector';
import { TrendChart } from '../../components/trend-chart';
import { apiFetch } from '../../../lib/api';

type Window = '7d' | '30d' | '90d';
type Bucket = 'day' | 'week';
type MetricKey = 'focus_hours' | 'cycle_time' | 'throughput';

interface TimeseriesResponse {
  data: Array<{ date: string; value: number }>;
}

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'focus_hours', label: 'Focus hours', unit: 'hours' },
  { key: 'cycle_time', label: 'Cycle time', unit: 'days' },
  { key: 'throughput', label: 'Throughput', unit: 'prs' },
];

export default function Trends() {
  const [window, setWindow] = useState<Window>('30d');
  const [bucket, setBucket] = useState<Bucket>('day');
  const [metric, setMetric] = useState<MetricKey>('focus_hours');
  const [data, setData] = useState<TimeseriesResponse | null>(null);

  useEffect(() => {
    apiFetch<TimeseriesResponse>(
      `/v1/metrics/timeseries?metric=${metric}&window=${window}&bucket=${bucket}`,
    )
      .then(setData)
      .catch(console.error);
  }, [metric, window, bucket]);

  const currentMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Trends</h1>
        <WindowSelector value={window} onChange={setWindow} />
      </div>

      <div className="flex gap-2 mb-4">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              metric === m.key
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          {(['day', 'week'] as Bucket[]).map((b) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                bucket === b
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <p className="text-xs text-neutral-500 mb-4">
          {currentMetric.label} — {window} by {bucket}
        </p>
        <TrendChart data={data?.data || []} unit={currentMetric.unit} />
      </div>
    </div>
  );
}
