export interface EventInput {
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
  // Optional: present for duration-bearing events (manual entries, calendar).
  durationMs?: number | null;
  source?: string;
}

export interface MetricResult {
  value: number | null;
  delta: number | null;
  unit: string;
}

export interface TimeseriesPoint {
  date: string;
  value: number;
}
