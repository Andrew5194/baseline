'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GOAL_PALETTE } from '../../lib/goal-colors';

// A small swatch that opens a palette of the 10 goal colors. The palette renders in
// a portal (fixed position) so it's never clipped by a card, and onOpenChange lets
// the parent keep its hover-only controls visible while the palette is open.
export function GoalColorPicker({
  current,
  onPick,
  onOpenChange,
}: {
  current: string;
  onPick: (color: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function setOpenState(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpenState(false);
    };
    const onClose = () => setOpenState(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle() {
    if (open) {
      setOpenState(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpenState(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Goal color"
        className="w-3 h-3 rounded-full border border-black/10 dark:border-white/15 hover:scale-110 transition-transform"
        style={{ backgroundColor: current }}
      />
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-50 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl grid grid-cols-5 gap-1.5"
          >
            {GOAL_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onPick(c);
                  setOpenState(false);
                }}
                aria-label={c}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                  c === current ? 'ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-300 dark:ring-offset-neutral-900' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
