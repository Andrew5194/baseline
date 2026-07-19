'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GOAL_PALETTE } from '../../lib/goal-colors';

// The per-goal overflow (kebab) menu: Edit, a row of color swatches, then a
// divider and a red Delete. Renders in a portal (fixed position) so it's never
// clipped by a card, and closes on outside click / scroll / resize.
export function GoalActionsMenu({
  color,
  onEdit,
  onPickColor,
  onDelete,
}: {
  color: string;
  onEdit: () => void;
  onPickColor: (color: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onClose = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpen(true);
  }

  const itemClass =
    'flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-sm text-left transition-colors';

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Goal actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`p-1 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          open ? 'text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800' : ''
        }`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-50 w-48 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className={`${itemClass} text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit goal name
            </button>

            <div className="px-2.5 pt-2 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1.5">Color</p>
              <div className="grid grid-cols-5 gap-1.5">
                {GOAL_PALETTE.map((c) => (
                  <button
                    key={c}
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onPickColor(c);
                    }}
                    aria-label={c}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                      c === color ? 'ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-300 dark:ring-offset-neutral-900' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className={`${itemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
