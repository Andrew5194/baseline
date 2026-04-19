'use client';

import { useMemo, useState } from 'react';
import { DayDetailsModal } from './day-details-modal';

interface HeatmapDay {
  date: string;
  value: number;
}

interface MetricValue {
  value: number | null;
  delta: number | null;
  unit: string;
}

interface ContributionHeatmapProps {
  data: HeatmapDay[];
  events?: Array<{ occurred_at: string }>;
  overviewMetrics?: Record<string, MetricValue>;
  window?: string;
}

type Tab = 'metrics' | 'heatmap' | 'patterns';

function getLevel(count: number, max: number): number {
  if (count === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const levelColors = [
  'bg-neutral-100 dark:bg-neutral-800',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-500',
  'bg-emerald-600 dark:bg-emerald-400',
];

export function ContributionHeatmap({ data, events, overviewMetrics, window }: ContributionHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);

  const { weeks, maxCount, stats, dowData, bestDay } = useMemo(() => {
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const max = Math.max(...sorted.map((d) => d.value), 1);

    const wks: (HeatmapDay | null)[][] = [];
    if (sorted.length > 0) {
      let currentWeek: (HeatmapDay | null)[] = [];
      const firstDow = new Date(sorted[0].date + 'T00:00:00').getDay();
      for (let i = 0; i < firstDow; i++) currentWeek.push(null);

      sorted.forEach((day, index) => {
        currentWeek.push(day);
        const dow = new Date(day.date + 'T00:00:00').getDay();
        if (dow === 6) {
          wks.push(currentWeek);
          currentWeek = [];
        }
        if (index === sorted.length - 1 && currentWeek.length > 0) {
          wks.push(currentWeek);
        }
      });
    }

    const total = sorted.reduce((s, d) => s + d.value, 0);
    const activeDays = sorted.filter((d) => d.value > 0).length;
    const totalDays = sorted.length;
    const activePct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;
    const deepWorkDays = sorted.filter((d) => d.value >= 5).length;

    const currentStreak = (() => {
      let streak = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].value > 0) streak++;
        else break;
      }
      return streak;
    })();
    const longestStreak = (() => {
      let best = 0, current = 0;
      for (const d of sorted) {
        if (d.value > 0) { current++; best = Math.max(best, current); }
        else current = 0;
      }
      return best;
    })();

    const dailyAvg = totalDays > 0 ? (total / totalDays).toFixed(2) : '0';
    const peakDay = sorted.length > 0
      ? sorted.reduce((best, d) => (d.value > best.value ? d : best), sorted[0])
      : { date: '', value: 0 };

    const last30 = sorted.slice(-30);
    const last7 = sorted.slice(-7);
    const rolling30 = last30.length > 0
      ? (last30.reduce((s, d) => s + d.value, 0) / last30.length).toFixed(1)
      : '0';
    const rolling7 = last7.length > 0
      ? (last7.reduce((s, d) => s + d.value, 0) / last7.length).toFixed(2)
      : '0';

    const weekendDays = sorted.filter((d) => {
      const dow = new Date(d.date + 'T00:00:00').getDay();
      return dow === 0 || dow === 6;
    });
    const weekdayDays = sorted.filter((d) => {
      const dow = new Date(d.date + 'T00:00:00').getDay();
      return dow > 0 && dow < 6;
    });
    const weekdayAvg = weekdayDays.length > 0
      ? (weekdayDays.reduce((s, d) => s + d.value, 0) / weekdayDays.length).toFixed(1)
      : '0';
    const weekendAvg = weekendDays.length > 0
      ? (weekendDays.reduce((s, d) => s + d.value, 0) / weekendDays.length).toFixed(1)
      : '0';

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayBuckets: Record<string, number[]> = {};
    dayNames.forEach((n) => (dayBuckets[n] = []));
    sorted.forEach((d) => {
      const dow = new Date(d.date + 'T00:00:00').getDay();
      dayBuckets[dayNames[dow]].push(d.value);
    });
    const dow = dayNames.map((name) => {
      const vals = dayBuckets[name];
      const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      return { name, short: name.slice(0, 3), average: parseFloat(avg.toFixed(1)) };
    });
    const best = dow.reduce((b, d) => (d.average > b.average ? d : b), dow[0]);

    return {
      weeks: wks,
      maxCount: max,
      stats: {
        total, activeDays, totalDays, activePct, deepWorkDays,
        currentStreak, longestStreak, dailyAvg, peakDay,
        rolling30, rolling7, weekdayAvg, weekendAvg, consistencyScore: activePct,
      },
      dowData: dow,
      bestDay: best,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-neutral-400">
        No contribution data available
      </div>
    );
  }

  const maxDowAvg = Math.max(...dowData.map((d) => d.average), 1);

  const hourData = (() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    if (events) {
      for (const e of events) {
        const h = new Date(e.occurred_at).getHours();
        hours[h].count++;
      }
    }
    return hours;
  })();
  const maxHourCount = Math.max(...hourData.map((h) => h.count), 1);
  const peakHour = hourData.reduce((best, h) => (h.count > best.count ? h : best), hourData[0]);
  const formatHour = (h: number) => {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  };

  return (
    <>
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          {([
            { key: 'metrics' as Tab, label: 'Detailed Metrics' },
            { key: 'heatmap' as Tab, label: 'Activity Map' },
            { key: 'patterns' as Tab, label: 'Patterns' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-4 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Detailed Metrics */}
          {activeTab === 'metrics' && (() => {
            const fmtDelta = (d: number | null | undefined) =>
              d == null ? '' : `${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}% vs prior ${window || '30d'}`;
            const commits = overviewMetrics?.commits;
            const throughput = overviewMetrics?.throughput;
            const linesChanged = overviewMetrics?.lines_changed;
            const reviews = overviewMetrics?.reviews;
            return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Commits', value: commits?.value ?? stats.total, sub: fmtDelta(commits?.delta) || `across ${stats.totalDays} days` },
                  { label: 'PRs Merged', value: throughput?.value ?? 0, sub: fmtDelta(throughput?.delta) || 'no prior data' },
                  { label: 'Lines Changed', value: linesChanged?.value ?? 0, sub: fmtDelta(linesChanged?.delta) || 'no prior data' },
                  { label: 'Reviews Given', value: reviews?.value ?? 0, sub: fmtDelta(reviews?.delta) || 'no prior data' },
                  { label: 'Current Streak', value: `${stats.currentStreak}d`, sub: `longest: ${stats.longestStreak}d` },
                  { label: 'Daily Average', value: stats.dailyAvg, sub: `7d avg: ${stats.rolling7}` },
                  { label: 'Deep Work Days', value: stats.deepWorkDays, sub: '5+ contributions' },
                  { label: 'Weekday vs Weekend', value: `${stats.weekdayAvg} / ${stats.weekendAvg}`, sub: 'avg contributions' },
                ].map((stat, i) => (
                  <div key={i} className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">{stat.label}</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stat.value}</p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{stat.sub}</p>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">Computed insights</p>
                <div className="space-y-3 font-mono text-sm text-neutral-600 dark:text-neutral-400">
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    Most productive on <span className="font-semibold text-neutral-900 dark:text-white">{bestDay.name}s</span> — {bestDay.average} avg contributions
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {Number(stats.weekdayAvg) > Number(stats.weekendAvg)
                      ? `${(Number(stats.weekdayAvg) / Math.max(Number(stats.weekendAvg), 0.01)).toFixed(1)}x more active on weekdays`
                      : Number(stats.weekendAvg) > Number(stats.weekdayAvg)
                      ? `${(Number(stats.weekendAvg) / Math.max(Number(stats.weekdayAvg), 0.01)).toFixed(1)}x more active on weekends`
                      : 'Equal activity on weekdays and weekends'}
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {stats.deepWorkDays} deep work days (5+ contributions) out of {stats.totalDays}
                  </p>
                  {stats.peakDay.date && (
                    <p>
                      <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                      Peak: {stats.peakDay.value} contributions on {new Date(stats.peakDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* Activity Map */}
          {activeTab === 'heatmap' && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="min-w-0 flex-1">
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="flex gap-[3px] w-fit">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[3px]">
                        {Array.from({ length: 7 }, (_, ri) => {
                          const day = week[ri] ?? null;
                          if (!day) {
                            return <div key={`${wi}-${ri}`} className="w-[11px] h-[11px]" />;
                          }
                          const level = getLevel(day.value, maxCount);
                          return (
                            <div
                              key={`${wi}-${ri}`}
                              className={`w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-emerald-400/60 hover:scale-110 ${levelColors[level]}`}
                              onMouseEnter={() => setHoveredDay(day)}
                              onMouseLeave={() => setHoveredDay(null)}
                              onClick={() => day.value > 0 && setSelectedDay(day)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
                    <span>Less</span>
                    <div className="flex gap-1">
                      {levelColors.map((cls, i) => (
                        <div key={i} className={`w-[11px] h-[11px] rounded-[2px] ${cls}`} />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                  {hoveredDay && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {new Date(hoveredDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' — '}
                      <span className="font-semibold text-neutral-900 dark:text-white">{hoveredDay.value}</span>
                      {' contributions'}
                    </div>
                  )}
                </div>
              </div>

              {/* Hover panel */}
              <div className="w-full lg:w-[260px] lg:flex-shrink-0">
                {hoveredDay ? (
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-5 space-y-4">
                    <div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">Date</p>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {new Date(hoveredDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">Contributions</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{hoveredDay.value}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1.5">Relative activity</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min((hoveredDay.value / maxCount) * 100, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{Math.round((hoveredDay.value / maxCount) * 100)}%</span>
                      </div>
                    </div>
                    {hoveredDay.value > 0 && (
                      <button
                        onClick={() => setSelectedDay(hoveredDay)}
                        className="w-full text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors pt-2 border-t border-neutral-200 dark:border-neutral-700"
                      >
                        View full breakdown &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 p-5 h-full flex items-center justify-center min-h-[160px]">
                    <div className="text-center text-neutral-300 dark:text-neutral-600 space-y-1.5">
                      <p className="text-xs">Hover a day to preview</p>
                      <p className="text-[10px]">Click for full breakdown</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Patterns */}
          {activeTab === 'patterns' && (
            <div className="space-y-10">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">Average contributions by day of week</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Peak: {bestDay.name}</p>
                </div>
                <div className="flex items-end gap-3 h-40">
                  {dowData.map((d, i) => {
                    const h = maxDowAvg > 0 ? (d.average / maxDowAvg) * 100 : 0;
                    const isBest = d.name === bestDay.name;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{d.average.toFixed(1)}</span>
                        <div className="w-full relative" style={{ height: '100px' }}>
                          <div
                            className={`absolute bottom-0 w-full rounded-t-md transition-all ${isBest ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                            style={{ height: `${Math.max(h * 0.85, d.average > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-medium ${isBest ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'}`}>{d.short}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {events && events.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">Activity by hour of day</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Peak: {formatHour(peakHour.hour)}</p>
                  </div>
                  <div className="flex items-end gap-[3px] h-28">
                    {hourData.map((h) => {
                      const height = maxHourCount > 0 ? (h.count / maxHourCount) * 100 : 0;
                      const isPeak = h.hour === peakHour.hour;
                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center gap-1" title={`${formatHour(h.hour)}: ${h.count} events`}>
                          <div className="w-full relative" style={{ height: '72px' }}>
                            <div
                              className={`absolute bottom-0 w-full rounded-t-sm transition-all ${isPeak ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                              style={{ height: `${Math.max(height * 0.85, h.count > 0 ? 2 : 0)}%` }}
                            />
                          </div>
                          {h.hour % 6 === 0 && (
                            <span className="text-[9px] text-neutral-400 dark:text-neutral-500">{formatHour(h.hour)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">Pattern analysis</p>
                <div className="space-y-3 font-mono text-sm text-neutral-600 dark:text-neutral-400">
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {bestDay.name}s are your most productive day ({bestDay.average} avg)
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {stats.deepWorkDays} deep work days (5+ contributions) out of {stats.totalDays}
                  </p>
                  {events && events.length > 0 && (
                    <p>
                      <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                      Most active hour: {formatHour(peakHour.hour)} with {peakHour.count} events
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day details modal */}
      {selectedDay && (
        <DayDetailsModal
          date={selectedDay.date}
          contributionCount={selectedDay.value}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </>
  );
}
