import type { EventInput } from './types';

/**
 * Count of code reviews submitted in the window.
 */
export function reviewCountV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  return events.filter(
    (e) =>
      e.eventType === 'github.pr.reviewed' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd,
  ).length;
}

/**
 * Review-to-PR ratio — how many reviews you give per PR you merge.
 * Higher ratio = more collaborative. null if no PRs merged.
 */
export function reviewRatioV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number | null {
  const reviews = reviewCountV1(events, windowStart, windowEnd);
  const prs = events.filter(
    (e) =>
      e.eventType === 'github.pr.merged' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd,
  ).length;

  if (prs === 0) return null;
  return Math.round((reviews / prs) * 10) / 10;
}
