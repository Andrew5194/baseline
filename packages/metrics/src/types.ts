export interface EventInput {
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
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
