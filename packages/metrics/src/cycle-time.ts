import type { EventInput } from './types';

export function cycleTimeDaysV1(
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

  const cycleTimes: number[] = [];

  for (const pr of prs) {
    const mergedAt = pr.occurredAt.getTime();
    const createdAt = pr.payload?.created_at
      ? new Date(pr.payload.created_at as string).getTime()
      : null;
    const firstCommitAt = pr.payload?.first_commit_at
      ? new Date(pr.payload.first_commit_at as string).getTime()
      : null;

    const startTime = firstCommitAt || createdAt;
    if (!startTime) continue;

    const days = (mergedAt - startTime) / (1000 * 60 * 60 * 24);
    if (days >= 0) cycleTimes.push(days);
  }

  if (cycleTimes.length === 0) return null;

  cycleTimes.sort((a, b) => a - b);
  const mid = Math.floor(cycleTimes.length / 2);
  const median =
    cycleTimes.length % 2 === 0
      ? (cycleTimes[mid - 1] + cycleTimes[mid]) / 2
      : cycleTimes[mid];

  return Math.round(median * 10) / 10;
}
