'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { AssistantPanel, BaselineAIMark } from './assistant-panel';

const WIDTH = 380; // px
const STORAGE_KEY = 'baseline.assistant.open';

// Global, dockable AI assistant. Slides in/out from the right edge on every page.
// Mounted in the dashboard layout, so its open state and conversation persist as
// the user navigates between pages.
export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore persisted open/closed state on first mount.
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') setOpen(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);
  useEffect(() => {
    if (mounted) window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  }, [open, mounted]);

  async function createGoal(payload: Record<string, unknown>) {
    await apiFetch('/v1/goals', { method: 'POST', body: JSON.stringify(payload) }).catch(console.error);
    // Let any mounted Goals page refresh itself.
    window.dispatchEvent(new CustomEvent('baseline:goals-changed'));
  }

  return (
    <>
      {/* Launcher — top-right button matching the app's UI; hides while the dock is open */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Baseline AI"
        className={`fixed top-5 right-6 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm font-medium text-neutral-700 dark:text-neutral-200 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all duration-200 ${
          open ? 'opacity-0 pointer-events-none translate-y-1' : 'opacity-100'
        }`}
      >
        <BaselineAIMark className="w-5 h-5" />
        Ask AI
      </button>

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 h-full z-50 transition-transform duration-300 ease-out will-change-transform"
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
