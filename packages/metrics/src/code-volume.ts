import type { EventInput } from './types';

/**
 * Total lines of code changed (additions + deletions) from merged PRs.
 */
export function linesChangedV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  let total = 0;
  for (const e of events) {
    if (
      e.eventType === 'github.pr.merged' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd &&
      e.payload
    ) {
      total += (e.payload.additions as number) || 0;
      total += (e.payload.deletions as number) || 0;
    }
  }
  return total;
}

/**
 * Average PR size (lines changed per PR).
 */
export function avgPrSizeV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number | null {
  const prs = events.filter(
    (e) =>
      e.eventType === 'github.pr.merged' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd &&
      e.payload,
  );

  if (prs.length === 0) return null;

  const totalLines = prs.reduce((sum, e) => {
    return sum + ((e.payload?.additions as number) || 0) + ((e.payload?.deletions as number) || 0);
  }, 0);

  return Math.round(totalLines / prs.length);
}

/**
 * Average files changed per PR.
 */
export function avgFilesChangedV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number | null {
  const prs = events.filter(
    (e) =>
      e.eventType === 'github.pr.merged' &&
      e.occurredAt >= windowStart &&
      e.occurredAt < windowEnd &&
      e.payload,
  );

  if (prs.length === 0) return null;

  const totalFiles = prs.reduce((sum, e) => {
    return sum + ((e.payload?.changed_files as number) || 0);
  }, 0);

  return Math.round((totalFiles / prs.length) * 10) / 10;
}
