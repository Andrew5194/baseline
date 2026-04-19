import type { EventInput } from './types';

export function throughputTasksV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  return events.filter(
    (e) =>
      e.eventType === 'github.pr.merged' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd,
  ).length;
}
