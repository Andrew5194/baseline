'use client';

import { useState, useEffect } from 'react';
import { fetchContributions, ContributionDay } from '../lib/githubAPI';
import { calculateStatistics, getContributionLevel, Statistics } from '../lib/analytics';
import DayDetailsModal from './DayDetailsModal';

interface GitHubHeatmapProps {
  username: string;
  token?: string;
}

type Tab = 'metrics' | 'heatmap' | 'patterns';

export default function GitHubHeatmap({ username, token }: GitHubHeatmapProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [selectedDay, setSelectedDay] = useState<ContributionDay | null>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number; x: number; y: number; day: ContributionDay; avg: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [hoveredHeatmapDay, setHoveredHeatmapDay] = useState<ContributionDay | null>(null);

  useEffect(() => {
    async function loadContributions() {
      try {
        setLoading(true);
        const data = await fetchContributions(username, token);
        setContributions(data.contributions);
        setStats(calculateStatistics(data.contributions));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch contributions');
      } finally {
        setLoading(false);
      }
    }
    loadContributions();
  }, [username, token]);

  useEffect(() => {
    if (!loading && stats) {
      const timer = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(timer);
    }
  }, [loading, stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!stats || contributions.length === 0) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">No contribution data available</p>
      </div>
    );
  }

  // ── Shared data prep ──
  const sorted = [...contributions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const last90 = sorted.slice(-90);
  const maxCount = Math.max(...last90.map((c) => c.count), 1);

  // Rolling 7-day average
  const rollingAvgPoints = last90.map((day, i) => {
    const start = Math.max(0, i - 6);
    const win = last90.slice(start, i + 1);
    const avg = win.reduce((s, d) => s + d.count, 0) / win.length;
    return { date: day.date, avg, count: day.count };
  });

  const avgValue = last90.reduce((s, d) => s + d.count, 0) / last90.length;

  // SVG chart geometry
  const svgW = 600, svgH = 200;
  const padL = 40, padR = 20, padT = 20, padB = 30;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;
  const maxY = Math.max(maxCount * 1.15, avgValue * 2, 4);
  const toX = (i: number) => padL + (i / (last90.length - 1)) * chartW;
  const toY = (v: number) => padT + chartH - (v / maxY) * chartH;

  const rollingLine = rollingAvgPoints
    .map((p, i) => `${toX(i).toFixed(1)},${toY(p.avg).toFixed(1)}`)
    .join(' ');
  const areaPoints =
    rollingLine +
    ` ${toX(last90.length - 1).toFixed(1)},${toY(0).toFixed(1)}` +
    ` ${toX(0).toFixed(1)},${toY(0).toFixed(1)}`;
  const baselineY = toY(avgValue);

  const xLabels: { label: string; x: number }[] = [];
  const labelCount = Math.min(10, last90.length);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (last90.length - 1));
    xLabels.push({
      label: new Date(last90[idx].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      x: toX(idx),
    });
  }
  const yLabelCount = 5;
  const yLabels = Array.from({ length: yLabelCount }, (_, i) => ({
    label: Math.round((i / (yLabelCount - 1)) * maxY).toString(),
    y: toY((i / (yLabelCount - 1)) * maxY),
  }));

  // ── Derived metrics ──
  const prior30 = sorted.slice(-60, -30);
  const priorAvg = prior30.length > 0 ? prior30.reduce((s, d) => s + d.count, 0) / prior30.length : 0;
  const trendPct = priorAvg > 0 ? Math.round(((stats.rolling7 - priorAvg) / priorAvg) * 100) : 0;
  const trendSign = trendPct >= 0 ? '+' : '';
  const activePct = Math.round((stats.activeDays / stats.totalDays) * 100);

  const bestDay = Object.entries(stats.byDayOfWeek).reduce(
    (best, [day, data]) => (data.average > best.avg ? { day, avg: data.average } : best),
    { day: '', avg: 0 }
  );

  const deepWorkDays = sorted.filter((d) => d.count >= 5).length;
  const weekendContribs = sorted.filter((d) => {
    const dow = new Date(d.date).getDay();
    return dow === 0 || dow === 6;
  });
  const weekdayContribs = sorted.filter((d) => {
    const dow = new Date(d.date).getDay();
    return dow > 0 && dow < 6;
  });
  const weekendAvg =
    weekendContribs.length > 0
      ? (weekendContribs.reduce((s, d) => s + d.count, 0) / weekendContribs.length).toFixed(1)
      : '0';
  const weekdayAvg =
    weekdayContribs.length > 0
      ? (weekdayContribs.reduce((s, d) => s + d.count, 0) / weekdayContribs.length).toFixed(1)
      : '0';

  const consistencyScore = activePct;
  const peakDay = stats.maxDay;

  // Heatmap weeks
  const maxContributions = Math.max(...sorted.map((c) => c.count));
  const weeks: ContributionDay[][] = [];
  let currentWeek: ContributionDay[] = [];
  sorted.forEach((contrib, index) => {
    const dow = new Date(contrib.date).getDay();
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(contrib);
    if (index === sorted.length - 1) weeks.push(currentWeek);
  });

  // Monthly data for patterns tab
  const monthKeys = Object.keys(stats.byMonth).sort();
  const monthData = monthKeys.map((key) => ({
    key,
    label: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    ...stats.byMonth[key],
  }));
  const maxMonthTotal = Math.max(...monthData.map((m) => m.total), 1);

  // Day-of-week data
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowData = dayNames.map((name) => ({
    name,
    short: name.slice(0, 3),
    ...stats.byDayOfWeek[name],
  }));
  const maxDowAvg = Math.max(...dowData.map((d) => d.average), 1);

  return (
    <div className="space-y-8">
      {/* ─── Trend Chart Card ─── */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm p-6 pb-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
            Contribution Trends — Last 90 Days
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-[1px] bg-neutral-300 dark:bg-neutral-600 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 5px)' }} />
              <span className="text-[10px] text-neutral-400 dark:text-neutral-600">Avg baseline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-[1.5px] bg-emerald-500 rounded-full" />
              <span className="text-[10px] text-neutral-400 dark:text-neutral-600">7-day rolling avg</span>
            </div>
          </div>
        </div>

        {/* SVG */}
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {yLabels.map((yl, i) => (
            <line key={i} x1={padL} y1={yl.y} x2={svgW - padR} y2={yl.y} className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth="1" />
          ))}
          {yLabels.map((yl, i) => (
            <text key={i} x={padL - 8} y={yl.y + 3} textAnchor="end" className="fill-neutral-300 dark:fill-neutral-700" fontSize="9" fontFamily="ui-monospace, monospace">{yl.label}</text>
          ))}
          {xLabels.map((xl, i) => (
            <text key={i} x={xl.x} y={svgH - 5} textAnchor="middle" className="fill-neutral-300 dark:fill-neutral-700" fontSize="8" fontFamily="ui-monospace, monospace">{xl.label}</text>
          ))}

          {/* Baseline */}
          <line x1={padL} y1={baselineY} x2={svgW - padR} y2={baselineY} className="stroke-neutral-200 dark:stroke-neutral-700" strokeWidth="0.75" strokeDasharray="4 3" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out' }} />
          <text x={svgW - padR} y={Math.min(baselineY - 6, padT + chartH - 12)} textAnchor="end" className="fill-neutral-400 dark:fill-neutral-500" fontSize="7" fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="400" style={{ opacity: visible ? 1 : 0, transition: 'opacity 1s ease-out 0.5s' }}>
            baseline ({avgValue.toFixed(1)}/day)
          </text>

          {/* Area + line */}
          <polygon points={areaPoints} className="fill-emerald-500/[0.04] dark:fill-emerald-500/[0.06]" style={{ opacity: visible ? 1 : 0, transition: 'opacity 1.5s ease-out 1.5s' }} />
          <polyline points={rollingLine} fill="none" className="stroke-emerald-500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 2000, strokeDashoffset: visible ? 0 : 2000, transition: 'stroke-dashoffset 2s ease-out 0.6s' }} />

          {/* Daily dots */}
          {last90.map((day, i) =>
            day.count === 0 ? null : (
              <circle key={i} cx={toX(i)} cy={toY(day.count)} r="1.2" className="fill-emerald-500/25" style={{ opacity: visible ? 1 : 0, transition: `opacity 0.3s ease-out ${1 + i * 0.01}s` }} />
            )
          )}

          {/* Key data points */}
          {rollingAvgPoints
            .filter((_p, i) => i % 9 === 0 || i === rollingAvgPoints.length - 1)
            .map((p) => {
              const idx = rollingAvgPoints.indexOf(p);
              return (
                <circle key={idx} cx={toX(idx)} cy={toY(p.avg)} r="2.5" className="fill-white dark:fill-neutral-900 stroke-emerald-500" strokeWidth="1.5" style={{ opacity: visible ? 1 : 0, transition: `opacity 0.3s ease-out ${1 + idx * 0.015}s` }} />
              );
            })}

          {/* Hover zones */}
          {last90.map((day, i) => (
            <rect key={i} x={toX(i) - chartW / last90.length / 2} y={padT} width={chartW / last90.length} height={chartH} fill="transparent" className="cursor-pointer"
              onMouseEnter={() => setHoveredPoint({ index: i, x: toX(i), y: toY(rollingAvgPoints[i].avg), day, avg: rollingAvgPoints[i].avg })}
              onClick={() => day.count > 0 && setSelectedDay(day)}
            />
          ))}

          {/* Hover indicator */}
          {hoveredPoint && (
            <>
              <line x1={hoveredPoint.x} y1={padT} x2={hoveredPoint.x} y2={padT + chartH} className="stroke-neutral-200 dark:stroke-neutral-700" strokeWidth="0.75" strokeDasharray="3 3" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" className="fill-emerald-500/20" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="2.5" className="fill-white dark:fill-neutral-900 stroke-emerald-500" strokeWidth="1.5" />
              <foreignObject x={Math.min(hoveredPoint.x - 60, svgW - padR - 125)} y={Math.max(hoveredPoint.y - 56, padT)} width="120" height="48">
                <div className="bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-md px-2 py-1.5 shadow-sm text-center">
                  <p className="text-[7px] text-neutral-400 dark:text-neutral-500 leading-tight">{new Date(hoveredPoint.day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-[9px] font-semibold text-neutral-900 dark:text-white leading-tight mt-0.5">{hoveredPoint.day.count} contributions</p>
                  <p className="text-[7px] text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">7d avg: {hoveredPoint.avg.toFixed(1)}</p>
                </div>
              </foreignObject>
            </>
          )}
        </svg>

        {/* Summary metric cards */}
        <div className="flex items-center justify-center gap-3 mt-2 mb-1">
          {[
            { label: 'Total', value: stats.total.toString(), change: `${trendSign}${trendPct}% trend` },
            { label: 'Streak', value: `${stats.currentStreak}d`, change: `Best: ${stats.longestStreak}d` },
            { label: 'Daily avg', value: stats.avgDaily.toString(), change: `${activePct}% active` },
            { label: 'Peak day', value: peakDay.count.toString(), change: peakDay.date ? new Date(peakDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' },
          ].map((m, i) => (
            <div key={i} className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 text-center" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: `opacity 0.5s ease-out ${2 + i * 0.2}s, transform 0.5s ease-out ${2 + i * 0.2}s` }}>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">{m.label}</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{m.value}</p>
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{m.change}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tabbed Detail Panel ─── */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Tab Bar */}
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

        {/* Tab Content */}
        <div className="p-8">
          {/* ── Detailed Metrics ── */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  { label: 'Total Contributions', value: stats.total, sub: `across ${stats.totalDays} days` },
                  { label: 'Current Streak', value: `${stats.currentStreak}d`, sub: `longest: ${stats.longestStreak}d` },
                  { label: 'Daily Average', value: stats.avgDaily, sub: `7d avg: ${stats.rolling7}` },
                  { label: '30-Day Rolling Avg', value: stats.rolling30, sub: `7d avg: ${stats.rolling7}` },
                  { label: 'Active Days', value: stats.activeDays, sub: `${activePct}% of all days` },
                  { label: 'Deep Work Days', value: deepWorkDays, sub: '5+ contributions' },
                  { label: 'Consistency Score', value: `${consistencyScore}%`, sub: 'active / total days' },
                  { label: 'Weekday vs Weekend', value: `${weekdayAvg} / ${weekendAvg}`, sub: 'avg contributions' },
                ].map((stat, i) => (
                  <div key={i} className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">{stat.label}</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stat.value}</p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* Insight callouts */}
              <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">Computed insights</p>
                <div className="space-y-3 font-mono text-sm text-neutral-600 dark:text-neutral-400">
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    Most productive on <span className="font-semibold text-neutral-900 dark:text-white">{bestDay.day}s</span> — {bestDay.avg} avg contributions
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {Number(weekdayAvg) > Number(weekendAvg)
                      ? `${(Number(weekdayAvg) / Math.max(Number(weekendAvg), 0.01)).toFixed(1)}x more active on weekdays`
                      : `${(Number(weekendAvg) / Math.max(Number(weekdayAvg), 0.01)).toFixed(1)}x more active on weekends`}
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {trendPct > 0 ? `Output up ${trendPct}% vs prior 30 days` : trendPct < 0 ? `Output down ${Math.abs(trendPct)}% vs prior 30 days` : 'Output steady vs prior 30 days'}
                  </p>
                  {peakDay.date && (
                    <p>
                      <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                      Peak: {peakDay.count} contributions on {new Date(peakDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Activity Heatmap ── */}
          {activeTab === 'heatmap' && (
            <div>
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Grid + Legend */}
                <div className="min-w-0 flex-1">
                  <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-[3px] w-fit p-1">
                      {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px] flex-shrink-0">
                          {week.map((day, di) => {
                            const level = getContributionLevel(day.count, maxContributions);
                            return (
                              <div
                                key={di}
                                className={`w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-emerald-400/60 hover:scale-110 ${
                                  level === 0
                                    ? 'bg-neutral-100 dark:bg-neutral-800'
                                    : level === 1
                                    ? 'bg-emerald-200 dark:bg-emerald-900'
                                    : level === 2
                                    ? 'bg-emerald-400 dark:bg-emerald-700'
                                    : level === 3
                                    ? 'bg-emerald-500'
                                    : 'bg-emerald-600 dark:bg-emerald-400'
                                }`}
                                onMouseEnter={() => setHoveredHeatmapDay(day)}
                                onMouseLeave={() => setHoveredHeatmapDay(null)}
                                onClick={() => setSelectedDay(day)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pl-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                    <span>Less</span>
                    <div className="flex gap-1">
                      <div className="w-[11px] h-[11px] bg-neutral-100 dark:bg-neutral-800 rounded-[2px]" />
                      <div className="w-[11px] h-[11px] bg-emerald-200 dark:bg-emerald-900 rounded-[2px]" />
                      <div className="w-[11px] h-[11px] bg-emerald-400 dark:bg-emerald-700 rounded-[2px]" />
                      <div className="w-[11px] h-[11px] bg-emerald-500 rounded-[2px]" />
                      <div className="w-[11px] h-[11px] bg-emerald-600 dark:bg-emerald-400 rounded-[2px]" />
                    </div>
                    <span>More</span>
                  </div>
                </div>

                {/* Hover Panel */}
                <div className="w-full lg:w-[260px] lg:flex-shrink-0">
                  {hoveredHeatmapDay ? (
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-5 space-y-4">
                      <div>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">Date</p>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {new Date(hoveredHeatmapDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">Contributions</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{hoveredHeatmapDay.count}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1.5">Relative activity</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${maxContributions > 0 ? Math.min((hoveredHeatmapDay.count / maxContributions) * 100, 100) : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{maxContributions > 0 ? Math.round((hoveredHeatmapDay.count / maxContributions) * 100) : 0}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedDay(hoveredHeatmapDay)}
                        className="w-full text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors pt-2 border-t border-neutral-200 dark:border-neutral-700"
                      >
                        View full breakdown &rarr;
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 p-5 h-full flex items-center justify-center min-h-[160px]">
                      <div className="text-center text-neutral-300 dark:text-neutral-600 space-y-1.5">
                        <svg className="w-7 h-7 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        <p className="text-xs">Hover a day to preview</p>
                        <p className="text-[10px]">Click for full breakdown</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Patterns ── */}
          {activeTab === 'patterns' && (
            <div className="space-y-10">
              {/* Day-of-week */}
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white mb-6">Average contributions by day of week</p>
                <div className="flex items-end gap-3 h-40">
                  {dowData.map((d, i) => {
                    const h = maxDowAvg > 0 ? (d.average / maxDowAvg) * 100 : 0;
                    const isBest = d.name === bestDay.day;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">{d.average.toFixed(1)}</span>
                        <div className="w-full relative" style={{ height: '100px' }}>
                          <div
                            className={`absolute bottom-0 w-full rounded-t-md transition-all ${isBest ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                            style={{ height: `${Math.max(h * 0.85, 3)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-medium ${isBest ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'}`}>{d.short}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly trend */}
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white mb-6">Monthly contributions</p>
                <div className="space-y-2.5">
                  {monthData.map((m, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500 w-16 flex-shrink-0">{m.label}</span>
                      <div className="flex-1 h-6 bg-neutral-100 dark:bg-neutral-800 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/70 dark:bg-emerald-500/50 rounded-md transition-all"
                          style={{ width: `${(m.total / maxMonthTotal) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 w-8 text-right flex-shrink-0">{m.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pattern insights */}
              <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">Pattern analysis</p>
                <div className="space-y-3 font-mono text-sm text-neutral-600 dark:text-neutral-400">
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {bestDay.day}s are your most productive day ({bestDay.avg} avg)
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                    {deepWorkDays} deep work days (5+ contributions) out of {stats.totalDays}
                  </p>
                  {monthData.length >= 2 && (() => {
                    const recent = monthData[monthData.length - 1];
                    const prior = monthData[monthData.length - 2];
                    const change = prior.total > 0 ? Math.round(((recent.total - prior.total) / prior.total) * 100) : 0;
                    return (
                      <p>
                        <span className="text-emerald-600 dark:text-emerald-400">$</span>{' '}
                        {change >= 0 ? `+${change}%` : `${change}%`} month-over-month ({prior.label} → {recent.label})
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Day Details Modal ─── */}
      {selectedDay && (
        <DayDetailsModal
          username={username}
          date={selectedDay.date}
          contributionCount={selectedDay.count}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
