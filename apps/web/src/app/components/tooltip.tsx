'use client';

import { useState, cloneElement, isValidElement, type ReactElement, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const MAX_W = 240; // matches max-w-[15rem]

// Lightweight styled hover tooltip. Attaches to its single child (no wrapper, so it
// works even inside overflow-hidden) and renders the bubble in a portal at
// document.body. Opens to the RIGHT so it never covers the element's own text,
// flipping left only when there's no room. Instant and never clipped, unlike `title`.
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  const [rect, setRect] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);
  if (!isValidElement(children)) return children;

  const props = children.props as {
    className?: string;
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
  };

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      setRect(null);
      props.onMouseLeave?.(e);
    },
  });

  let bubble: ReactNode = null;
  if (rect && content) {
    const vw = window.innerWidth;
    let style: { top: number; left: number; transform: string };
    if (vw < 480) {
      // Mobile: opening sideways spills off the narrow viewport, so place the bubble
      // below the item (or above when it's in the lower half) and clamp its left edge
      // to stay fully on screen.
      const left = Math.min(Math.max(GAP, rect.left), vw - MAX_W - GAP);
      style =
        rect.top > window.innerHeight / 2
          ? { top: rect.top - GAP, left, transform: 'translate(0, -100%)' }
          : { top: rect.bottom + GAP, left, transform: 'translate(0, 0)' };
    } else {
      // Desktop: top aligns with the hovered item; opens right (or left when no room)
      // so it never overlaps the row or nearby lines.
      const openLeft = rect.right + GAP + MAX_W > vw;
      style = openLeft
        ? { top: rect.top, left: rect.left - GAP, transform: 'translate(-100%, 0)' }
        : { top: rect.top, left: rect.right + GAP, transform: 'translate(0, 0)' };
    }
    bubble = createPortal(
      <span
        style={{ position: 'fixed', ...style }}
        className="pointer-events-none z-[60] w-max max-w-[15rem] rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg dark:bg-neutral-700 dark:text-neutral-100"
      >
        {content}
      </span>,
      document.body,
    );
  }

  return (
    <>
      {trigger}
      {bubble}
    </>
  );
}
