'use client';

import { useState, useRef, useEffect } from 'react';
import { SOURCE_META } from './source-badge';

interface SourceDropdownProps {
  value: string; // 'all' or a source id
  onChange: (value: string) => void;
  sources: string[]; // source ids that have metrics
}

// Dropdown to pick which integration's metrics to view: "All sources" plus each
// source that currently has metrics (new integrations appear automatically).
export function SourceDropdown({ value, onChange, sources }: SourceDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const options = sources.map((s) => ({ id: s, label: SOURCE_META[s]?.label ?? s, icon: SOURCE_META[s]?.icon ?? null as React.ReactNode }));
  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        {current.icon}
        {current.label}
        <svg
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 z-30 min-w-[170px] py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${
                o.id === value ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <span className="w-3.5 flex items-center justify-center flex-shrink-0">{o.icon}</span>
              <span className="flex-1">{o.label}</span>
              {o.id === value && (
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
