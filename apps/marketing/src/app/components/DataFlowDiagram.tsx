'use client';

import { useEffect, useState, useRef } from 'react';

export default function DataFlowDiagram() {
  const [visible, setVisible] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setPulsing(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const sources = [
    {
      label: 'GitHub',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-neutral-800 dark:fill-neutral-200">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      ),
    },
    {
      label: 'Slack',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]">
          <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A" />
          <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0" />
          <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.163 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D" />
          <path d="M15.163 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.163 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.315A2.528 2.528 0 0124 15.163a2.528 2.528 0 01-2.522 2.523h-6.315z" fill="#ECB22E" />
        </svg>
      ),
    },
    {
      label: 'Google Cal',
      icon: (
        <svg viewBox="-3.75 -3.75 200 200" className="w-[18px] h-[18px]">
          <path fill="#FFFFFF" d="M148.882,43.618l-47.368-5.263l-57.895,5.263L38.355,96.25l5.263,52.632l52.632,6.579l52.632-6.579l5.263-53.947z" />
          <path fill="#1A73E8" d="M65.211,125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c0.829,3.158,2.276,5.605,4.342,7.342c2.053,1.737,4.553,2.592,7.474,2.592c2.987,0,5.553-0.908,7.697-2.724s3.224-4.132,3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921,0,5.382-0.789,7.382-2.368c2-1.579,3-3.737,3-6.487c0-2.447-0.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684,0-4.816,0.711-6.395,2.145s-2.724,3.197-3.447,5.276l-9.039-3.763c1.197-3.395,3.395-6.395,6.618-8.987c3.224-2.592,7.342-3.895,12.342-3.895c3.697,0,7.026,0.711,9.974,2.145c2.947,1.434,5.263,3.421,6.934,5.947c1.671,2.539,2.5,5.382,2.5,8.539c0,3.224-0.776,5.947-2.329,8.184c-1.553,2.237-3.461,3.947-5.724,5.145v0.539c2.987,1.25,5.421,3.158,7.342,5.724c1.908,2.566,2.868,5.632,2.868,9.211s-0.908,6.776-2.724,9.579c-1.816,2.803-4.329,5.013-7.513,6.618c-3.197,1.605-6.789,2.421-10.776,2.421C73.408,129.263,69.145,127.934,65.211,125.276z" />
          <path fill="#1A73E8" d="M121.25,79.961l-9.974,7.25l-5.013-7.605l17.987-12.974h6.895v61.197h-9.895z" />
          <path fill="#EA4335" d="M148.882,196.25l47.368-47.368l-23.684-10.526l-23.684,10.526l-10.526,23.684z" />
          <path fill="#34A853" d="M33.092,172.566l10.526,23.684h105.263v-47.368H43.618z" />
          <path fill="#4285F4" d="M12.039-3.75C3.316-3.75-3.75,3.316-3.75,12.039v136.842l23.684,10.526l23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75z" />
          <path fill="#188038" d="M-3.75,148.882v31.579c0,8.724,7.066,15.789,15.789,15.789h31.579v-47.368z" />
          <path fill="#FBBC04" d="M148.882,43.618v105.263h47.368V43.618l-23.684-10.526z" />
          <path fill="#1967D2" d="M196.25,43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368z" />
        </svg>
      ),
    },
    {
      label: 'Notion',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-neutral-800 dark:fill-neutral-200">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.41 2.33c-.42-.326-.98-.7-2.055-.607L3.62 2.7c-.466.046-.56.28-.374.466l1.213 1.042zm.793 2.616v13.874c0 .746.373 1.026 1.213.98l14.523-.84c.84-.046.933-.56.933-1.166V5.824c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.746.327-.746.886zm14.337.7c.093.42 0 .84-.42.886l-.7.14v10.264c-.606.327-1.166.514-1.633.514-.746 0-.933-.234-1.493-.933l-4.571-7.182v6.95l1.446.327s0 .84-1.166.84l-3.22.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.824 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.758 7.276v-6.44l-1.213-.14c-.093-.513.28-.886.746-.933l3.228-.186z" />
        </svg>
      ),
    },
    {
      label: 'Jira',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]">
          <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84A.84.84 0 0021.16 2H11.53z" fill="#2684FF" />
          <path d="M6.77 6.8a4.36 4.36 0 004.34 4.34h1.78v1.72a4.36 4.36 0 004.34 4.34V7.63a.84.84 0 00-.83-.83H6.77z" fill="url(#jiraGrad1)" />
          <path d="M2 11.6a4.35 4.35 0 004.34 4.34h1.78v1.72c0 2.4 1.94 4.34 4.34 4.34v-9.57a.84.84 0 00-.84-.83H2z" fill="url(#jiraGrad2)" />
          <defs>
            <linearGradient id="jiraGrad1" x1="12.54" y1="6.81" x2="8.13" y2="12.64">
              <stop stopColor="#0052CC" />
              <stop offset="1" stopColor="#2684FF" />
            </linearGradient>
            <linearGradient id="jiraGrad2" x1="8.21" y1="11.47" x2="3.37" y2="16.96">
              <stop stopColor="#0052CC" />
              <stop offset="1" stopColor="#2684FF" />
            </linearGradient>
          </defs>
        </svg>
      ),
    },
  ];

  const outputs = [
    { label: 'Trends', desc: 'Week over week' },
    { label: 'Metrics', desc: 'Quantitative' },
    { label: 'Patterns', desc: 'Behavioral' },
  ];

  // Layout dimensions matching Tailwind classes
  const labelH = 18;     // "Integrations"/"Insights" header (text-[9px] + mb-1)
  const srcCardH = 34;   // Source cards: py-2 (16px) + 18px icon
  const outCardH = 44;   // Output cards: py-2.5 (20px) + ~24px text
  const gapPx = 8;       // gap-2

  // Source column height drives the diagram
  const colH = labelH + sources.length * srcCardH + (sources.length - 1) * gapPx;

  // Source card center Y positions
  const srcCenters = sources.map((_, i) => labelH + srcCardH / 2 + i * (srcCardH + gapPx));

  // Convergence point
  const midY = colH / 2;

  // Output card centers (vertically centered within colH)
  const outContentH = labelH + outputs.length * outCardH + (outputs.length - 1) * gapPx;
  const outOffset = (colH - outContentH) / 2;
  const outCenters = outputs.map((_, i) => outOffset + labelH + outCardH / 2 + i * (outCardH + gapPx));

  const svgW = 80;

  return (
    <div ref={ref} className="w-full max-w-3xl mx-auto my-16">
      <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        <div className="relative px-8 py-10">
          <div className="flex items-start justify-between gap-2">

            {/* Sources */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500 text-center mb-1">Integrations</span>
              {sources.map((source, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 w-[116px] px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(-16px)',
                    transition: `opacity 0.4s ease-out ${i * 0.1}s, transform 0.4s ease-out ${i * 0.1}s`,
                  }}
                >
                  <span className="flex-shrink-0">{source.icon}</span>
                  <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">{source.label}</span>
                </div>
              ))}
            </div>

            {/* Left connectors */}
            <div className="flex-shrink-0 w-12 sm:w-16" style={{ height: `${colH}px` }}>
              <svg className="w-full h-full" viewBox={`0 0 ${svgW} ${colH}`} fill="none">
                {sources.map((_, i) => {
                  const y = srcCenters[i];
                  return (
                    <g key={i}>
                      {pulsing && (
                        <circle r="1.5" className="fill-emerald-500/70">
                          <animateMotion
                            dur={`${1.5 + i * 0.15}s`}
                            repeatCount="indefinite"
                            path={`M0,${y} L${svgW},${y}`}
                          />
                        </circle>
                      )}
                      <path
                        d={`M0,${y} L${svgW},${y}`}
                        className="stroke-neutral-300 dark:stroke-neutral-700"
                        strokeWidth="1"
                        style={{
                          opacity: visible ? 1 : 0,
                          transition: `opacity 0.5s ease-out ${0.5 + i * 0.08}s`,
                        }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center — Baseline */}
            <div className="flex-shrink-0 flex items-center" style={{ height: `${colH}px` }}>
              <div
                className="relative"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'scale(1)' : 'scale(0.9)',
                  transition: 'opacity 0.6s ease-out 0.7s, transform 0.6s ease-out 0.7s',
                }}
              >
                <div
                  className="absolute -inset-4 rounded-2xl bg-emerald-400/10 dark:bg-emerald-500/10 blur-lg transition-opacity duration-[2s] ease-in"
                  style={{
                    opacity: visible ? 1 : 0,
                    animation: pulsing ? 'pulse 3s ease-in-out infinite' : 'none',
                  }}
                />

                <div className="relative w-[88px] h-[88px] rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-neutral-900 flex flex-col items-center justify-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.1)] dark:shadow-[0_0_16px_rgba(16,185,129,0.2)]">
                  <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                    <rect width="28" height="28" rx="8" className="fill-emerald-500" />
                    <path d="M7 17h14" className="stroke-white/50" strokeWidth="1" strokeLinecap="round" />
                    <path d="M7 17 L12 14 L16.5 16 L21 8.5" className="stroke-white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[9px] font-semibold text-neutral-900 dark:text-white tracking-tight">Baseline</span>
                </div>
              </div>
            </div>

            {/* Right connectors */}
            <div className="flex-shrink-0 w-12 sm:w-16" style={{ height: `${colH}px` }}>
              <svg className="w-full h-full" viewBox={`0 0 ${svgW} ${colH}`} fill="none">
                {outputs.map((_, i) => {
                  const y = outCenters[i];
                  return (
                    <g key={i}>
                      {pulsing && (
                        <circle r="1.5" className="fill-emerald-500/70">
                          <animateMotion
                            dur={`${1.4 + i * 0.15}s`}
                            repeatCount="indefinite"
                            path={`M0,${y} L${svgW},${y}`}
                          />
                        </circle>
                      )}
                      <path
                        d={`M0,${y} L${svgW},${y}`}
                        className="stroke-emerald-400 dark:stroke-emerald-500/40"
                        strokeWidth="1"
                        style={{
                          opacity: visible ? 1 : 0,
                          transition: `opacity 0.5s ease-out ${1 + i * 0.08}s`,
                        }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Outputs */}
            <div className="flex flex-col gap-2 flex-shrink-0 justify-center" style={{ height: `${colH}px` }}>
              <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500 text-center mb-1">Insights</span>
              {outputs.map((output, i) => (
                <div
                  key={i}
                  className="w-[116px] px-3 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/[0.06] text-center"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(16px)',
                    transition: `opacity 0.4s ease-out ${1.2 + i * 0.12}s, transform 0.4s ease-out ${1.2 + i * 0.12}s`,
                  }}
                >
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{output.label}</p>
                  <p className="text-[9px] text-emerald-600/60 dark:text-emerald-400/50 mt-0.5">{output.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
