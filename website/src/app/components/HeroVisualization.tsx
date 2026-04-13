'use client';

import { useEffect, useState } from 'react';

export default function HeroVisualization() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto mt-10 px-4">
      <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm p-6 pb-4 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Weekly Productivity</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] bg-neutral-300 dark:bg-neutral-600 rounded-full" />
              <span className="text-[10px] text-neutral-400 dark:text-neutral-600">Baseline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] bg-emerald-500 rounded-full" />
              <span className="text-[10px] text-neutral-400 dark:text-neutral-600">Your trend</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <svg viewBox="0 0 600 200" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="40"
              y1={30 + i * 40}
              x2="580"
              y2={30 + i * 40}
              className="stroke-neutral-100 dark:stroke-neutral-800"
              strokeWidth="1"
            />
          ))}

          {/* Y-axis labels */}
          {['High', '', '', '', 'Low'].map((label, i) => (
            <text
              key={i}
              x="32"
              y={34 + i * 40}
              textAnchor="end"
              className="fill-neutral-300 dark:fill-neutral-700"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
          ))}

          {/* X-axis labels */}
          {['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'].map((label, i) => (
            <text
              key={i}
              x={67 + i * 54}
              y="195"
              textAnchor="middle"
              className="fill-neutral-300 dark:fill-neutral-700"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
          ))}

          {/* Baseline reference line */}
          <line
            x1="40"
            y1="110"
            x2="580"
            y2="110"
            className="stroke-neutral-300 dark:stroke-neutral-600"
            strokeWidth="1"
            strokeDasharray="6 4"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.8s ease-out',
            }}
          />
          <text
            x="580"
            y="106"
            textAnchor="end"
            className="fill-neutral-400 dark:fill-neutral-500"
            fontSize="9"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="500"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 1s ease-out 0.5s',
            }}
          >
            baseline
          </text>

          {/* Trajectory line */}
          <polyline
            points="67,130 121,120 175,115 229,108 283,95 337,100 391,82 445,70 499,58 553,42"
            fill="none"
            className="stroke-emerald-500"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 900,
              strokeDashoffset: visible ? 0 : 900,
              transition: 'stroke-dashoffset 2s ease-out 0.6s',
            }}
          />

          {/* Area fill under trajectory */}
          <polygon
            points="67,130 121,120 175,115 229,108 283,95 337,100 391,82 445,70 499,58 553,42 553,180 67,180"
            className="fill-emerald-500/[0.06] dark:fill-emerald-500/[0.08]"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 1.5s ease-out 1.5s',
            }}
          />

          {/* Data points */}
          {[
            [67, 130], [121, 120], [175, 115], [229, 108], [283, 95],
            [337, 100], [391, 82], [445, 70], [499, 58], [553, 42],
          ].map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="3.5"
              className="fill-white dark:fill-neutral-900 stroke-emerald-500"
              strokeWidth="2"
              style={{
                opacity: visible ? 1 : 0,
                transition: `opacity 0.3s ease-out ${1 + i * 0.15}s`,
              }}
            />
          ))}
        </svg>

        {/* Floating metric cards */}
        <div className="flex items-center justify-center gap-3 mt-2 mb-1">
          {[
            { label: 'Focus hours', value: '32.5h', change: '+12%' },
            { label: 'Cycle time', value: '2.1d', change: '-18%' },
            { label: 'Throughput', value: '47 tasks', change: '+23%' },
          ].map((metric, i) => (
            <div
              key={i}
              className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 text-center"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 0.5s ease-out ${2 + i * 0.2}s, transform 0.5s ease-out ${2 + i * 0.2}s`,
              }}
            >
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">{metric.label}</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{metric.value}</p>
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{metric.change}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
