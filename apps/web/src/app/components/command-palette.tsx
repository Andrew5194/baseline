'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

export interface Command {
  id: string;
  label: string;
  group?: string;
  // Extra terms to match on (not shown) — synonyms, e.g. "log time" for Add entry.
  keywords?: string;
  // Right-aligned hint, e.g. the current value of a toggle.
  hint?: string;
  run: () => void;
}

// A ⌘K / Ctrl-K command palette. Renders its own discoverable trigger plus the
// overlay, and owns open/query/selection state. Scoped-agnostic: the caller
// supplies the command list, so the same palette can drive any screen.
export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Global ⌘K / Ctrl-K toggles the palette from anywhere on the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset selection + focus the input each time it opens.
  useEffect(() => {
    if (open) {
      setSelected(0);
      // Focus after paint so the autofocus lands reliably.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''} ${c.group ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Keep the highlighted row in range as the filtered set shrinks.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    close();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(selected);
    }
  };

  // Scroll the highlighted row into view during keyboard navigation.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600 dark:border-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-neutral-200 bg-neutral-50 px-1 font-sans text-[10px] text-neutral-400 sm:inline dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 dark:border-neutral-800">
              <svg className="h-4 w-4 flex-shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a command or search…"
                className="w-full bg-transparent py-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
              />
            </div>

            <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">No matching commands.</p>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={c.id}
                    data-idx={i}
                    onClick={() => runAt(i)}
                    onMouseMove={() => setSelected(i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      i === selected
                        ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {c.group && <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-300 dark:text-neutral-600">{c.group}</span>}
                      <span className="truncate">{c.label}</span>
                    </span>
                    {c.hint && <span className="flex-shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{c.hint}</span>}
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-neutral-100 px-4 py-2 text-[10px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
              <span><kbd className="font-sans">↑↓</kbd> navigate</span>
              <span><kbd className="font-sans">↵</kbd> select</span>
              <span><kbd className="font-sans">esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
