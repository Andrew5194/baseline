'use client';

import { useState, cloneElement, isValidElement, type ReactElement, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

// A lightweight styled hover tooltip. Attaches to its single child element (no extra
// wrapper, so it works anywhere — even inside overflow-hidden containers) and renders
// the bubble in a portal at document.body, positioned above the child. Unlike the
// native `title` attribute it's instant, styled, and never clipped.
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  if (!isValidElement(children)) return children;

  const props = children.props as {
    className?: string;
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
  };

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    className: `${props.className ?? ''} cursor-help`.trim(),
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
      props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      setPos(null);
      props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {trigger}
      {pos && content
        ? createPortal(
            <span
              style={{ position: 'fixed', top: pos.top - 8, left: pos.left, transform: 'translate(-50%, -100%)' }}
              className="pointer-events-none z-[60] w-max max-w-[16rem] rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg dark:bg-neutral-700 dark:text-neutral-100"
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
