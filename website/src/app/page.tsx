'use client';

import { useState, useEffect } from 'react';
import GitHubHeatmap from './components/GitHubHeatmap';
import HeroVisualization from './components/HeroVisualization';
import DataFlowDiagram from './components/DataFlowDiagram';
import { ThemeToggle } from './components/ThemeToggle';
import Link from 'next/link';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-x-hidden transition-colors duration-200">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/30 via-white to-cyan-100/20 dark:from-emerald-900/20 dark:via-neutral-950 dark:to-cyan-900/10" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-emerald-400/[0.07] dark:bg-emerald-500/[0.06] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-cyan-400/[0.05] dark:bg-cyan-500/[0.04] rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-200 ${scrolled ? 'bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800' : 'border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" className="fill-neutral-900 dark:fill-white" />
              <path d="M7 17h14" className="stroke-white/60 dark:stroke-neutral-900/40" strokeWidth="1" strokeLinecap="round" />
              <path d="M7 17 L12 14 L16.5 16 L21 8.5" className="stroke-white dark:stroke-neutral-900" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight">Baseline</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">How It Works</a>
            <a href="#metrics" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Metrics</a>
            <a href="#activity" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Activity</a>
            <Link href="/contact" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://github.com/Andrew5194/automate-my-life"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <a
              href="https://github.com/Andrew5194/automate-my-life"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-28 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="animate-fade-in space-y-5">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.1]">
              Measure your rate
              <br />
              of progress
            </h1>
            <p className="text-lg text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed">
              A next-gen productivity analytics platform.
              Connect your tools. Establish your baseline. Shape your trajectory.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <a
                href="https://github.com/Andrew5194/automate-my-life"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium px-6 py-3 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors text-sm"
              >
                <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
              </a>
              <a href="#how-it-works" className="inline-flex items-center justify-center text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-6 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                Learn more
              </a>
            </div>
          </div>

          <HeroVisualization />
        </div>
      </section>

      {/* The Problem */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 border-t border-neutral-100 dark:border-neutral-900">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">The problem</p>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 tracking-tight">
            Tracking productivity shouldn&apos;t be this hard
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mb-16 leading-relaxed">
            Existing productivity tools shift the burden of measurement onto the individual.
            The result is fragmented data, inconsistent tracking, and no reliable way to
            evaluate performance over time.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                label: 'Fragmented tooling',
                problem: 'Meaningful work output is distributed across version control, project management, communication platforms, and calendars — with no unified view.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                ),
              },
              {
                label: 'High-friction tracking',
                problem: 'Traditional time tracking demands constant manual input: starting timers, categorizing tasks, and logging entries. Adherence drops off within days.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                label: 'Data without insight',
                problem: 'Even with complete data capture, most tools surface raw activity logs — not the trajectory analysis needed to identify trends over weeks and months.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 mb-4">
                  {item.icon}
                </div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">{item.label}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{item.problem}</p>
              </div>
            ))}
          </div>

          {/* How Baseline is different */}
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">How Baseline works</p>
          <h3 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 tracking-tight">
            Automatic tracking. Calculated metrics. Trends over time.
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mb-12 leading-relaxed">
            Baseline integrates with your existing development and project management tools,
            captures activity passively, and derives quantitative metrics and trend
            analysis — with minimal configuration required.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Connect your tools',
                description: 'Link GitHub, your calendar, and your project boards. Baseline pulls your activity automatically — no timers, no manual entry, no behavior changes.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.678-5.504a4.5 4.5 0 00-6.364-6.364L4.5 8.737m8.058-2.874L10.5 8.737" />
                  </svg>
                ),
              },
              {
                title: 'See your metrics',
                description: 'Baseline calculates the metrics that matter — time spent, output, cycle time, focus hours — so you don\'t have to build your own dashboards.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                  </svg>
                ),
              },
              {
                title: 'Track your trends',
                description: 'See how your productivity changes week over week, month over month. Spot patterns, identify what\'s working, and understand where your time actually goes.',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    {item.icon}
                  </div>
                  <div className="text-xs font-mono text-neutral-400 dark:text-neutral-600">0{i + 1}</div>
                </div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <DataFlowDiagram />
        </div>
      </section>

      {/* Metrics */}
      <section id="metrics" className="relative z-10 py-24 px-6 border-t border-neutral-100 dark:border-neutral-900">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">Metrics</p>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-12 tracking-tight">
            Three layers of insight
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">Output</h3>
              <p className="text-xs text-neutral-400 mb-4">What you shipped</p>
              <ul className="space-y-2">
                {['Tasks completed', 'Commits & PRs merged', 'Focus hours logged', 'Deep work ratio'].map((item, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="w-1 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">Velocity</h3>
              <p className="text-xs text-neutral-400 mb-4">How fast you move</p>
              <ul className="space-y-2">
                {['Cycle time per task type', 'Completion rate', 'Rescheduling frequency', 'Interruption recovery'].map((item, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="w-1 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Calibration</h3>
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">Core</span>
              </div>
              <p className="text-xs text-neutral-400 mb-4">Whether you&apos;re improving</p>
              <ul className="space-y-2">
                {['Estimation accuracy', 'Throughput trends', 'Consistency vs. variance', 'Compounding rate'].map((item, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Insight examples */}
          <div className="mt-8 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 max-w-2xl">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest mb-3">Example insights</p>
            <div className="space-y-2 font-mono text-sm text-neutral-500 dark:text-neutral-400">
              <p><span className="text-emerald-600 dark:text-emerald-400">$</span> Time estimates 2x off for backend tasks</p>
              <p><span className="text-emerald-600 dark:text-emerald-400">$</span> 3x output on days with no morning meetings</p>
              <p><span className="text-emerald-600 dark:text-emerald-400">$</span> Cycle time down 18% this quarter</p>
            </div>
          </div>
        </div>
      </section>

      {/* GitHub Activity */}
      <section id="activity" className="relative z-10 py-24 px-6 border-t border-neutral-100 dark:border-neutral-900">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">Live demo</p>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3 tracking-tight">
            GitHub integration
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-12 max-w-lg">
            Contribution heatmaps, rolling averages, and trend analysis from real data. This is Baseline with one integration connected.
          </p>

          <GitHubHeatmap
            username={process.env.NEXT_PUBLIC_GITHUB_USERNAME || "YOUR_GITHUB_USERNAME"}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 border-t border-neutral-100 dark:border-neutral-900">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4 tracking-tight">
            Start measuring what matters
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8">
            Free and open source. Clone the repo and run it in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://github.com/Andrew5194/automate-my-life"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium px-6 py-3 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors text-sm"
            >
              Get Started
            </a>
            <Link href="/contact" className="inline-flex items-center justify-center text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-6 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-200 dark:border-neutral-800 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="8" className="fill-neutral-900 dark:fill-white" />
                  <path d="M7 17h14" className="stroke-white/60 dark:stroke-neutral-900/40" strokeWidth="1" strokeLinecap="round" />
                  <path d="M7 17 L12 14 L16.5 16 L21 8.5" className="stroke-white dark:stroke-neutral-900" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">Baseline</span>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Next-gen productivity analytics.<br />
                Open source. Self-hostable.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider mb-4">Product</p>
              <ul className="space-y-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                <li><a href="#how-it-works" className="hover:text-neutral-900 dark:hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#metrics" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Metrics</a></li>
                <li><a href="#activity" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Live Demo</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider mb-4">Developers</p>
              <ul className="space-y-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                <li><a href="https://github.com/Andrew5194/automate-my-life" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white transition-colors">GitHub</a></li>
                <li><a href="https://github.com/Andrew5194/automate-my-life" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Contribute</a></li>
                <li><a href="https://github.com/Andrew5194/automate-my-life/issues" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Issues</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider mb-4">Company</p>
              <ul className="space-y-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                <li><Link href="/contact" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-neutral-400 dark:text-neutral-500">&copy; {new Date().getFullYear()} Baseline Labs. All rights reserved.</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">GPL-3.0 License</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
