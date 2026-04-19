'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/trends', label: 'Trends' },
  { href: '/sources', label: 'Sources' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col">
      <div className="px-5 h-16 flex items-center gap-2.5 border-b border-neutral-200 dark:border-neutral-800">
        <svg className="w-6 h-6" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" className="fill-neutral-900 dark:fill-white" />
          <path d="M7 17h14" className="stroke-white/60 dark:stroke-neutral-900/40" strokeWidth="1" strokeLinecap="round" />
          <path d="M7 17 L12 14 L16.5 16 L21 8.5" className="stroke-white dark:stroke-neutral-900" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-base font-semibold tracking-tight">Baseline</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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
          onClick={async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const csrfRes = await fetch(`${apiUrl}/api/auth/csrf`, {
              credentials: 'include',
            });
            const { csrfToken } = await csrfRes.json();
            await fetch(`${apiUrl}/api/auth/signout`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ csrfToken, redirect: 'false' }),
              credentials: 'include',
            });
            window.location.href = '/sign-in';
          }}
          className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
