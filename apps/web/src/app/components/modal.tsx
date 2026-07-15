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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
