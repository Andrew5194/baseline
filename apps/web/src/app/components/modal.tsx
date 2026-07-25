'use client';

import { useEffect } from 'react';

// Lightweight centered modal: dimmed backdrop, click-outside and Escape to close.
export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      {/* Close on a click that lands on this wrapper itself (the area around the dialog),
          not on the dialog or its children. */}
      <div
        className="relative flex min-h-full items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
