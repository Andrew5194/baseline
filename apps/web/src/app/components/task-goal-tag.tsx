'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface GoalOpt {
  id: string;
  title: string;
  color: string; // effective color
}

interface TaskGoalTagProps {
  goals: GoalOpt[];
  value: string | null;
  goalTitle: string | null;
  goalColor: string | null; // effective color of the tagged goal
  onChange: (goalId: string | null) => void;
}

// A task's label: "Uncategorized" until tagged, then the goal's name in its color.
// The menu renders in a portal so it isn't clipped by the to-do list's overflow.
export function TaskGoalTag({ goals, value, goalTitle, goalColor, onChange }: TaskGoalTagProps) {
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
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  }

  const tagged = !!(value && goalTitle);
  const c = tagged ? goalColor ?? '#9ca3af' : null;

  return (
    <div className="flex-shrink-0">
      <button ref={btnRef} onClick={toggle} aria-label="Tag with a goal">
        {tagged ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium max-w-[150px]"
            style={{ color: c!, backgroundColor: `${c}1f` }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c! }} />
            <span className="truncate">{goalTitle}</span>
          </span>
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
            Uncategorized
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-50 min-w-[180px] max-h-60 overflow-y-auto py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl"
          >
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 flex-shrink-0" />
              Uncategorized
            </button>
            {goals.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  onChange(g.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                  g.id === value ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                <span className="truncate">{g.title}</span>
              </button>
            ))}
            {goals.length === 0 && <p className="px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500">No goals yet</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}
