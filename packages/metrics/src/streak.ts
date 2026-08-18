/**
 * Longest run of consecutive calendar days in a set of day keys (YYYY-MM-DD).
 *
 * Takes day keys rather than events so any source can use it — what counts as an
 * active day is the caller's business.
 */
export function longestDayStreak(dayKeys: Iterable<string>): number {
  const days = Array.from(new Set(dayKeys)).sort();
  if (days.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00Z');
    const curr = new Date(days[i] + 'T00:00:00Z');
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}
