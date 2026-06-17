'use client';

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { fetchContributions, ContributionDay } from '../lib/githubAPI';
import { calculateStatistics, Statistics } from '../lib/analytics';
import DayDetailsModal from './DayDetailsModal';

interface GitHubHeatmapProps {
  username: string;
  token?: string;
}

// Live demo mirroring the app's Metrics page: a consistency-score donut, a compact
// KPI strip, and a green bar chart you can click into for the day's breakdown.
export default function GitHubHeatmap({ username, token }: GitHubHeatmapProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [selectedDay, setSelectedDay] = useState<ContributionDay | null>(null);
  const [hovered, setHovered] = useState<ContributionDay | null>(null);
  const [lineInfo, setLineInfo] = useState<{ x: number; y: number; pct: number; value: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    async function load() {
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
    load();
  }, [username, token]);

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

  const sorted = [...contributions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // All displayed metrics are scoped to the last 90 days (matching the chart).
  const last = sorted.slice(-90);
  const winTotal = last.reduce((s, d) => s + d.count, 0);
  const winActive = last.filter((d) => d.count > 0).length;
  const winDays = last.length;
  const activePct = winDays ? Math.round((winActive / winDays) * 100) : 0;
  let curStreak = 0;
  for (let i = last.length - 1; i >= 0; i--) {
    if (last[i].count > 0) curStreak++;
    else break;
  }
  let bestStreak = 0;
  let run = 0;
  for (const d of last) {
    if (d.count > 0) {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else run = 0;
  }

  // Consistency ring
  const radius = 46;
  const stroke = 6;
  const circ = 2 * Math.PI * radius;
  const scoreColor = activePct >= 70 ? '#10b981' : activePct >= 40 ? '#f59e0b' : '#ef4444';

  const kpis: Array<{ label: string; value: string | number; sub?: string }> = [
    { label: 'Contributions', value: winTotal },
    { label: 'Active Days', value: winActive, sub: `/ ${winDays}` },
    { label: 'Best Streak', value: `${bestStreak}d` },
  ];

  // Bar chart — last 90 days
  const maxV = Math.max(...last.map((d) => d.count), 1);
  const yMax = maxV * 1.1;
  const W = 640;
  const H = 200;
  const mL = 30;
  const mR = 8;
  const mT = 14;
  const mB = 22;
  const iW = W - mL - mR;
  const iH = H - mT - mB;
  const step = iW / last.length;
  const bw = step * 0.68;
  const toY = (v: number) => mT + iH - (v / yMax) * iH;
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((maxV * i) / 4)).filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.ceil(last.length / 8);

  // Rolling 30-day active-day count, evaluated at each displayed day — a measure of
  // recent consistency (how many of the trailing 30 days had activity).
  const rollingActive = last.map((d) => {
    const end = new Date(d.date).getTime();
    const start = end - 29 * 86400000;
    let c = 0;
    for (const x of sorted) {
      const t = new Date(x.date).getTime();
      if (t >= start && t <= end && x.count > 0) c++;
    }
    return c;
  });
  const rollSMax = Math.max(Math.ceil(Math.max(...rollingActive, 1) / 5) * 5, 5);
  const toRY = (v: number) => mT + iH - (v / rollSMax) * iH;
  const rollPts = rollingActive.map((v, i) => `${(mL + i * step + step / 2).toFixed(1)},${toRY(v).toFixed(1)}`).join(' ');

  const showRollingPct = (e: ReactMouseEvent<SVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    let idx = Math.round((loc.x - mL - step / 2) / step);
    idx = Math.max(0, Math.min(last.length - 1, idx));
    const value = rollingActive[idx];
    setLineInfo({ x: mL + idx * step + step / 2, y: toRY(value), value, pct: Math.round((value / 30) * 100) });
  };

  return (
    <div className="space-y-6">
      {/* Consistency score */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex items-center gap-6">
        <div className="relative flex-shrink-0">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r={radius} fill="none" className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth={stroke} />
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke={scoreColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - (activePct / 100) * circ}
              transform="rotate(-90 56 56)"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">{activePct}</span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-0.5">%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Consistency Score</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {winActive} active days out of {winDays}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            Current streak {curStreak}d · best {bestStreak}d
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 grid grid-cols-3 divide-x divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
        {kpis.map((k, i) => (
          <div key={i} className="px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{k.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-white">
              {k.value}
              {k.sub && <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500"> {k.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="mb-4">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            Active days · last 90 days
          </p>
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHovered(null)}>
          <defs>
            <linearGradient id="demoBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="52%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={mL} x2={W - mR} y1={toY(t)} y2={toY(t)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth="1" strokeDasharray={t === 0 ? undefined : '4 5'} />
              <text x={mL - 6} y={toY(t) + 3} textAnchor="end" className="fill-neutral-300 dark:fill-neutral-700" fontSize="9">{t}</text>
            </g>
          ))}
          {last.map((d, i) => {
            const x = mL + i * step + (step - bw) / 2;
            const y = toY(d.count);
            const h = mT + iH - y;
            const dim = hovered !== null && hovered.date !== d.date;
            return (
              <g key={i} style={{ opacity: dim ? 0.4 : 1, transition: 'opacity 0.15s ease' }}>
                {d.count > 0 && <rect x={x} y={y} width={bw} height={h} rx={Math.min(1.5, bw / 2)} fill="url(#demoBar)" />}
                <rect
                  x={mL + i * step}
                  y={mT}
                  width={step}
                  height={iH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(d)}
                  onClick={() => d.count > 0 && setSelectedDay(d)}
                />
              </g>
            );
          })}
          {last.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={mL + i * step + step / 2} y={H - 6} textAnchor="middle" className="fill-neutral-300 dark:fill-neutral-700" fontSize="8">
                {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            ) : null,
          )}

          {/* Rolling 30-day active-day count — grey line; hover it to read the % */}
          <polyline points={rollPts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline
            points={rollPts}
            fill="none"
            stroke="transparent"
            strokeWidth="16"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseMove={showRollingPct}
            onMouseLeave={() => setLineInfo(null)}
          />
          {lineInfo && (
            <g style={{ pointerEvents: 'none' }}>
              <circle cx={lineInfo.x} cy={lineInfo.y} r="3.5" fill="#6366f1" stroke="white" strokeWidth="1.5" />
              <foreignObject x={Math.min(Math.max(lineInfo.x - 72, 0), W - 144)} y={Math.max(lineInfo.y - 44, 2)} width="144" height="40">
                <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 shadow text-center">
                  <p className="text-[8px] text-neutral-400 dark:text-neutral-500 leading-tight">Rolling 30-day active days</p>
                  <p className="text-[11px] font-semibold text-neutral-900 dark:text-white leading-tight">{lineInfo.pct}% · {lineInfo.value}/30</p>
                </div>
              </foreignObject>
            </g>
          )}
        </svg>
      </div>

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
