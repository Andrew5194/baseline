'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_URL } from '../../lib/api';
import { Logo } from './logo';

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/goals', label: 'Goals' },
  { href: '/metrics', label: 'Metrics' },
  { href: '/history', label: 'History' },
  { href: '/sources', label: 'Sources' },
  { href: '/settings', label: 'Settings' },
];

async function signOut() {
  try {
    const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
    const { csrfToken } = await csrfRes.json();
    // Auth.js answers sign-out with a 302 to the API's origin. Default `redirect:
    // 'follow'` would chase it cross-origin and throw on CORS. `redirect: 'manual'`
    // still applies the session-clearing Set-Cookie but doesn't follow — we navigate
    // to /sign-in ourselves.
    await fetch(`${API_URL}/api/auth/signout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken }),
      credentials: 'include',
      redirect: 'manual',
    });
  } catch {
    // Redirect regardless — the user should always land on the sign-in page.
  }
  window.location.href = '/sign-in';
}

// Shared nav body used by both the desktop sidebar and the mobile drawer.
function NavBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={signOut}
          className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-col">
        <div className="px-5 h-16 flex items-center border-b border-neutral-200 dark:border-neutral-800">
          <Link href="/" aria-label="Go to Overview" className="flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-lg hover:opacity-80 transition-opacity">
            <Logo className="w-6 h-6" />
            <span className="text-base font-semibold tracking-tight">Baseline</span>
          </Link>
        </div>
        <NavBody pathname={pathname} />
      </aside>

      {/* Mobile: fixed top bar with a menu button */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1 p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Logo className="w-6 h-6" />
          <span className="text-base font-semibold tracking-tight">Baseline</span>
        </Link>
      </header>

      {/* Mobile: slide-in drawer (always mounted so it can animate in/out) */}
      <div className={`md:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-64 max-w-[82%] bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-transform duration-300 ease-out will-change-transform ${
            open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <div className="px-4 h-14 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
              <Logo className="w-6 h-6" />
              <span className="text-base font-semibold tracking-tight">Baseline</span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <NavBody pathname={pathname} onNavigate={() => setOpen(false)} />
        </aside>
      </div>
    </>
  );
}
