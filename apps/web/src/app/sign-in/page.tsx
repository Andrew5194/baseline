'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const csrfRes = await fetch(`${apiUrl}/api/auth/csrf`, {
        credentials: 'include',
      });
      const { csrfToken } = await csrfRes.json();

      const callbackRes = await fetch(`${apiUrl}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, password, csrfToken, redirect: 'false' }),
        credentials: 'include',
        redirect: 'manual',
      });

      // NextAuth v5 with redirect:false returns JSON with either `url` (success)
      // or an error signaled by `url` pointing at /api/auth/error or an empty url.
      const callbackData = await callbackRes.json().catch(() => ({} as { url?: string | null }));
      const callbackUrl = callbackData.url ?? '';
      const signInFailed = !callbackUrl || callbackUrl.includes('/api/auth/error');

      if (signInFailed) {
        setError('Invalid email or password');
        return;
      }

      // Secondary verification: confirm the freshly-issued session matches the
      // email that was just submitted. Guards against any residual session.
      const sessionRes = await fetch(`${apiUrl}/api/auth/session`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const session = await sessionRes.json();

      if (session?.user?.email?.toLowerCase() === email.toLowerCase()) {
        window.location.href = '/';
      } else {
        setError('Invalid email or password');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <svg className="w-10 h-10" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" className="fill-neutral-900 dark:fill-white" />
              <path d="M7 17h14" className="stroke-white/60 dark:stroke-neutral-900/40" strokeWidth="1" strokeLinecap="round" />
              <path d="M7 17 L12 14 L16.5 16 L21 8.5" className="stroke-white dark:stroke-neutral-900" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Baseline</h1>
          <p className="text-sm text-neutral-500">
            Enter your credentials to access your dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-emerald-600 hover:text-emerald-500 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
