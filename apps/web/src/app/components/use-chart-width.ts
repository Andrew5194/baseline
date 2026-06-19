'use client';

import { useRef, useState, useLayoutEffect } from 'react';

// Tracks a container's width for responsive SVG charts. Measures synchronously
// before paint (no empty → pop-in flicker), then follows resizes.
export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}
