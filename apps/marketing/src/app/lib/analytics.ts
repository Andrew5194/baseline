/**
 * Analytics module for calculating statistics and rolling averages
 */

import { ContributionDay } from './githubAPI';

export interface RollingAveragePoint {
  date: string;
  value: number;
  count: number;
}

export interface Statistics {
  total: number;
  avgDaily: number;
  currentStreak: number;
  longestStreak: number;
  rolling7: number;
  rolling30: number;
  rolling7Data: RollingAveragePoint[];
  rolling30Data: RollingAveragePoint[];
  maxDay: { count: number; date: string | null };
  byDayOfWeek: Record<string, { total: number; count: number; average: number }>;
  byMonth: Record<string, { total: number; count: number; days: number }>;
  activeDays: number;
  totalDays: number;
}

/**
 * Calculates rolling average for a given window size
 */
export function calculateRollingAverage(
  data: ContributionDay[],
  windowSize: number
): RollingAveragePoint[] {
  const result: RollingAveragePoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const sum = window.reduce((acc, item) => acc + item.count, 0);
    const avg = sum / window.length;

    result.push({
      date: data[i].date,
      value: avg,
      count: data[i].count
    });
  }

  return result;
}

/**
 * Calculates current contribution streak
 */
export function calculateCurrentStreak(contributions: ContributionDay[]): number {
  if (contributions.length === 0) return 0;

  const sorted = [...contributions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mostRecentDate = new Date(sorted[0].date);
  const daysDiff = Math.floor((today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 1) return 0;

  let streak = 0;
  const expectedDate = new Date(sorted[0].date);

  for (const contrib of sorted) {
    const contribDate = new Date(contrib.date);

    if (contribDate.getTime() === expectedDate.getTime()) {
      if (contrib.count > 0) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates longest contribution streak
 */
export function calculateLongestStreak(contributions: ContributionDay[]): number {
  if (contributions.length === 0) return 0;

  const sorted = [...contributions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let longestStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const contrib of sorted) {
    if (contrib.count > 0) {
      if (prevDate) {
        const daysDiff = Math.floor(
          (new Date(contrib.date).getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      prevDate = new Date(contrib.date);
    } else {
      longestStreak = Math.max(longestStreak, currentStreak);
      currentStreak = 0;
      prevDate = null;
    }
  }

  return Math.max(longestStreak, currentStreak);
}

/**
 * Calculates average daily contributions
 */
export function calculateAverageDaily(contributions: ContributionDay[]): number {
  if (contributions.length === 0) return 0;

  const total = contributions.reduce((sum, item) => sum + item.count, 0);
  return parseFloat((total / contributions.length).toFixed(2));
}

/**
 * Calculates contributions by day of week
 */
export function calculateByDayOfWeek(contributions: ContributionDay[]) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay: Record<string, { total: number; count: number; average: number }> = {};

  dayNames.forEach(day => {
    byDay[day] = { total: 0, count: 0, average: 0 };
  });

  contributions.forEach(contrib => {
    const date = new Date(contrib.date);
    const dayName = dayNames[date.getDay()];
    byDay[dayName].total += contrib.count;
    byDay[dayName].count++;
  });

  Object.keys(byDay).forEach(day => {
    byDay[day].average = byDay[day].count > 0
      ? parseFloat((byDay[day].total / byDay[day].count).toFixed(2))
      : 0;
  });

  return byDay;
}

/**
 * Calculates contributions by month
 */
export function calculateByMonth(contributions: ContributionDay[]) {
  const byMonth: Record<string, { total: number; count: number; days: number }> = {};

  contributions.forEach(contrib => {
    const date = new Date(contrib.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth[monthKey]) {
      byMonth[monthKey] = {
        total: 0,
        count: 0,
        days: 0
      };
    }

    byMonth[monthKey].total += contrib.count;
    byMonth[monthKey].count++;
    if (contrib.count > 0) {
      byMonth[monthKey].days++;
    }
  });

  return byMonth;
}

/**
 * Calculates comprehensive statistics
 */
export function calculateStatistics(contributions: ContributionDay[]): Statistics {
  const total = contributions.reduce((sum, item) => sum + item.count, 0);
  const avgDaily = calculateAverageDaily(contributions);
  const currentStreak = calculateCurrentStreak(contributions);
  const longestStreak = calculateLongestStreak(contributions);

  const rolling7 = calculateRollingAverage(contributions, 7);
  const rolling30 = calculateRollingAverage(contributions, 30);

  const recent7Avg = rolling7.length > 0
    ? parseFloat(rolling7[rolling7.length - 1].value.toFixed(2))
    : 0;
  const recent30Avg = rolling30.length > 0
    ? parseFloat(rolling30[rolling30.length - 1].value.toFixed(2))
    : 0;

  const maxDay = contributions.reduce((max, item) =>
    item.count > max.count ? item : max,
    { count: 0, date: null as string | null }
  );

  const byDayOfWeek = calculateByDayOfWeek(contributions);
  const byMonth = calculateByMonth(contributions);

  return {
    total,
    avgDaily,
    currentStreak,
    longestStreak,
    rolling7: recent7Avg,
    rolling30: recent30Avg,
    rolling7Data: rolling7,
    rolling30Data: rolling30,
    maxDay,
    byDayOfWeek,
    byMonth,
    activeDays: contributions.filter(c => c.count > 0).length,
    totalDays: contributions.length
  };
}

/**
 * Determines contribution level (0-4) based on count
 */
export function getContributionLevel(count: number, max: number): number {
  if (count === 0) return 0;
  if (max === 0) return 0;

  const percentage = count / max;

  if (percentage >= 0.75) return 4;
  if (percentage >= 0.50) return 3;
  if (percentage >= 0.25) return 2;
  return 1;
}
