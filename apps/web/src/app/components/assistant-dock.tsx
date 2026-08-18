'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { AssistantPanel, MaxAIMark } from './assistant-panel';

const WIDTH = 380; // px
const STORAGE_KEY = 'baseline.assistant.open';

// Global, dockable AI assistant sliding in from the right edge. Mounted in the
// dashboard layout, so open state and conversation persist across navigation.
export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  // Restore persisted open/closed state on first mount.
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') setOpen(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);
  useEffect(() => {
    if (mounted) window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  }, [open, mounted]);

  // Close on outside click. Only armed while open; the launcher is
  // pointer-events-none when open, so it can't re-trigger.
  useEffect(() => {
    if (!open) return;
    // pointerdown (not mousedown) so an outside tap dismisses on touch too.
    const onDoc = (e: Event) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  async function createGoal(payload: Record<string, unknown>) {
    await apiFetch('/v1/goals', { method: 'POST', body: JSON.stringify(payload) }).catch(console.error);
    // Let any mounted Goals page refresh itself.
    window.dispatchEvent(new CustomEvent('baseline:goals-changed'));
  }

  return (
    <>
      {/* Launcher — the same circular mark at every size; hides while the dock is open */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Max AI"
        className={`fixed right-4 bottom-5 md:right-6 md:top-5 md:bottom-auto z-40 inline-flex items-center justify-center p-2.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all duration-200 ${
          open ? 'opacity-0 pointer-events-none translate-y-1' : 'opacity-100'
        }`}
      >
        <MaxAIMark className="w-6 h-6" />
      </button>

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className="fixed top-0 right-0 h-full max-w-full z-50 transition-transform duration-300 ease-out will-change-transform"
        style={{ width: WIDTH, transform: open ? 'translateX(0)' : `translateX(${WIDTH}px)` }}
        aria-hidden={!open}
      >
        <div className="h-full border-l border-neutral-200 dark:border-neutral-800 shadow-2xl">
          <AssistantPanel onCreateGoal={createGoal} onClose={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
