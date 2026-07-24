'use client';

import { useState, cloneElement, isValidElement, type ReactElement, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const MAX_W = 240; // matches max-w-[15rem]

// A lightweight styled hover tooltip. Attaches to its single child element (no extra
// wrapper, so it works anywhere — even inside overflow-hidden containers) and renders
// the bubble in a portal at document.body. It opens to the RIGHT of the element,
// vertically centered, so it never covers the element's own text or the lines above/
// below it — flipping to the left only when there isn't room on the right. Unlike the
// native `title` attribute it's instant, styled, and never clipped.
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  const [rect, setRect] = useState<{ top: number; left: number; right: number } | null>(null);
  if (!isValidElement(children)) return children;

  const props = children.props as {
    className?: string;
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
  };

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, right: r.right });
      props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      setRect(null);
      props.onMouseLeave?.(e);
    },
  });

  let bubble: ReactNode = null;
  if (rect && content) {
    const openLeft = rect.right + GAP + MAX_W > window.innerWidth;
    // Top of the tooltip aligns with the top of the hovered item; opens to its right
    // (or left when there's no room), so it never overlaps the row or nearby lines.
    const style = openLeft
      ? { top: rect.top, left: rect.left - GAP, transform: 'translate(-100%, 0)' as const }
      : { top: rect.top, left: rect.right + GAP, transform: 'translate(0, 0)' as const };
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
