'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { colorForCategory } from '../../lib/categories';

interface GoalOpt {
  id: string;
  title: string;
  color: string; // effective color
  category: string | null;
}

interface TaskGoalTagProps {
  goals: GoalOpt[];
  categories: string[]; // selectable categories (independent of goals)
  value: string | null; // tagged goal id
  goalTitle: string | null;
  goalColor: string | null; // effective color of the tagged goal
  category: string | null; // directly-tagged category (when not tagged to a goal)
  onChange: (sel: { goalId: string | null; category: string | null }) => void;
}

// A task's label. It can be tagged either to a goal (shown in the goal's color) or
// directly to a category — the menu lists both as separate sections. Untagged reads
// "Uncategorized". The menu renders in a portal so it isn't clipped by overflow.
export function TaskGoalTag({ goals, categories, value, goalTitle, goalColor, category, onChange }: TaskGoalTagProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    // Close when the page scrolls (the menu is position:fixed to the button), but
    // NOT when scrolling inside the menu's own list.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const margin = 12;
      const right = window.innerWidth - r.right;
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      // Open below by default; flip above when there's more room there. Either way
      // the menu is capped to the available space so its list scrolls inside.
      if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
        setPos({ top: r.bottom + 4, right, maxHeight: Math.max(160, spaceBelow) });
      } else {
        setPos({ bottom: window.innerHeight - r.top + 4, right, maxHeight: Math.max(160, spaceAbove) });
      }
    }
    setOpen(true);
  }

  const taggedGoal = !!(value && goalTitle);
  const taggedCat = !taggedGoal && !!category;
  // The chip's color + label reflect whichever tag is set.
  const chipColor = taggedGoal ? goalColor ?? '#9ca3af' : taggedCat ? colorForCategory(category!) : null;
  const chipLabel = taggedGoal ? goalTitle : taggedCat ? category : null;

  function pick(sel: { goalId: string | null; category: string | null }) {
    onChange(sel);
    setOpen(false);
  }

  return (
    <div className="flex-shrink-0">
      <button ref={btnRef} onClick={toggle} aria-label="Tag with a category or goal">
        {chipLabel ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium max-w-[150px]"
            style={{ color: chipColor!, backgroundColor: `${chipColor}1f` }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: chipColor! }} />
            <span className="truncate">{chipLabel}</span>
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
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, right: pos.right, maxHeight: pos.maxHeight }}
            className="z-50 min-w-[200px] overflow-y-auto py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl"
          >
            <button
              onClick={() => pick({ goalId: null, category: null })}
              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 flex-shrink-0" />
              Uncategorized
            </button>

            {goals.length > 0 && (
              <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Goals</p>
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => pick({ goalId: g.id, category: null })}
                    className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                      g.id === value ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="truncate">{g.title}</span>
                  </button>
                ))}
              </div>
            )}

            {categories.length > 0 && (
              <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Categories</p>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => pick({ goalId: null, category: cat })}
                    className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                      taggedCat && category === cat ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorForCategory(cat) }} />
                    <span className="truncate">{cat}</span>
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
