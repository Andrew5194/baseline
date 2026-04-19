import type { EventInput } from './types';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const MIN_BLOCK_HOURS = 0.5;

export function focusHoursV1(
  events: EventInput[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const commits = events
    .filter(
      (e) =>
        e.eventType === 'github.commit.pushed' &&
        e.occurredAt >= windowStart &&
        e.occurredAt < windowEnd,
    )
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (commits.length === 0) return 0;

  let totalHours = 0;
  let blockStart = commits[0].occurredAt.getTime();
  let blockEnd = blockStart;

  for (let i = 1; i < commits.length; i++) {
    const t = commits[i].occurredAt.getTime();
    if (t - blockEnd <= TWO_HOURS_MS) {
      blockEnd = t;
    } else {
      const blockHours = (blockEnd - blockStart) / (1000 * 60 * 60);
      totalHours += Math.max(blockHours, MIN_BLOCK_HOURS);
      blockStart = t;
      blockEnd = t;
    }
  }

  const lastBlockHours = (blockEnd - blockStart) / (1000 * 60 * 60);
  totalHours += Math.max(lastBlockHours, MIN_BLOCK_HOURS);

  return Math.round(totalHours * 10) / 10;
}
