'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ActionItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string; // hover tooltip (e.g. why a disabled item can't be used)
}

// Generic kebab (⋯) overflow menu. Trigger + fixed-position portal popover (so it's
// never clipped); a red-tinted divider precedes the first `danger` item. Closes on
// outside click / scroll / resize.
export function ActionsMenu({
  items,
  label = 'Actions',
  onOpen,
}: {
  items: ActionItem[];
  label?: string;
  onOpen?: () => void; // fired when the menu opens (e.g. to prefetch data it reveals)
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
    onOpen?.();
  }

  const firstDanger = items.findIndex((i) => i.danger);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={label}
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
            className="z-50 w-44 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl"
          >
            {items.map((item, i) => {
              const button = (
                <button
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.disabled ? undefined : item.title}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-sm text-left transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                    item.danger
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {item.label}
                </button>
              );
              return (
                <div key={i}>
                  {i === firstDanger && firstDanger > 0 && (
                    <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
                  )}
                  {/* Disabled button ignores pointer events, so wrap it to surface the tooltip on hover. */}
                  {item.disabled && item.title ? (
                    <span title={item.title} className="block cursor-not-allowed">
                      {button}
                    </span>
                  ) : (
                    button
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
