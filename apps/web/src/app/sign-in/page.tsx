'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '../../lib/api';
import { Logo } from '../components/logo';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  // Prefetch the CSRF token (and set its cookie) on page load so submitting the
  // form doesn't have to wait on a /csrf round-trip first. getCsrfToken() below
  // falls back to an on-demand fetch if this hasn't landed yet, so the flow is
  // never broken — just occasionally one round-trip slower.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCsrfToken(d?.csrfToken ?? '');
      })
      .catch(() => {
        /* prefetch failed — getCsrfToken() will fetch at submit time */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function getCsrfToken(): Promise<string> {
    if (csrfToken) return csrfToken;
    const res = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
    const { csrfToken: token } = await res.json();
    setCsrfToken(token ?? '');
    return token ?? '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = await getCsrfToken();

      // The `X-Auth-Return-Redirect` header makes Auth.js return the outcome as
      // JSON (`{ url }`) instead of a 302 — the same mechanism the built-in
      // signIn({ redirect: false }) uses. A failed login comes back with `?error=`
      // in the URL and sets no session cookie; a success returns a URL with no
      // error param. Reading the result here lets us skip the extra /session
      // round-trip the manual-redirect flow used to need.
      const res = await fetch(`${API_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Auth-Return-Redirect': '1',
        },
        body: new URLSearchParams({ email, password, csrfToken: token, callbackUrl: '/' }),
        credentials: 'include',
      });

      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      const succeeded =
        res.ok &&
        !!data?.url &&
        !new URL(data.url, window.location.origin).searchParams.has('error');

      if (succeeded) {
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo className="w-10 h-10" />
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
