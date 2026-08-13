'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { apiFetch, API_URL } from '../../../lib/api';
import { GoogleCalendarIcon, GooglePlayBooksIcon } from '../../components/source-badge';

interface Integration {
  id: string;
  provider: string;
  status: string;
  external_account_id: string | null;
  connected_at: string;
  last_synced_at: string | null;
}

// Providers the user can actually connect today. `authorize` is the OAuth route
// segment (/v1/integrations/{authorize}/authorize); `provider` matches the stored
// integration + event source.
const CONNECTABLE: Array<{
  provider: string;
  authorize: string;
  name: string;
  blurb: string;
  icon: ReactNode;
  /** Route segment under /sources for providers with settings. */
  configure?: string;
}> = [
  {
    provider: 'github',
    authorize: 'github',
    name: 'GitHub',
    blurb: 'Commits, PRs, and code reviews',
    configure: 'github',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    provider: 'google_calendar',
    authorize: 'google',
    name: 'Google Calendar',
    blurb: 'Meeting load, focus time, and schedule patterns',
    icon: <GoogleCalendarIcon className="w-5 h-5" />,
  },
  {
    provider: 'google_books',
    authorize: 'google-books',
    name: 'Google Play Books',
    blurb: 'Reading progress, from the bookmarks you leave',
    icon: <GooglePlayBooksIcon className="w-5 h-5" />,
    configure: 'google-books',
  },
];

export default function Sources() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Integration[]>('/v1/integrations')
      .then(setIntegrations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleConnect(authorize: string) {
    window.location.href = `${API_URL}/v1/integrations/${authorize}/authorize`;
  }

  async function handleDisconnect(id: string) {
    await apiFetch(`/v1/integrations/${id}`, { method: 'DELETE' });
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'disconnected', external_account_id: null } : i)),
    );
  }

  async function handleSync(id: string) {
    setSyncing(id);
    try {
      await apiFetch<{ status: string; events_count: number }>(`/v1/integrations/${id}/sync`, { method: 'POST' });
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, last_synced_at: new Date().toISOString() } : i)),
      );
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Sources</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Sources</h1>

      <div className="space-y-3">
        {CONNECTABLE.map((src, idx) => {
          const integration = integrations.find((i) => i.provider === src.provider && i.status === 'connected');
          return (
            <div
              key={src.provider}
              className="p-5 card-modern rise"
              style={{ animationDelay: `${40 + idx * 60}ms` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                    {src.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{src.name}</p>
                    {integration ? (
                      <p className="text-xs text-neutral-500 break-words">
                        {integration.external_account_id ? `${integration.external_account_id} · ` : ''}Last sync:{' '}
                        {integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString() : 'never'}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400">{src.blurb}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {integration ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {src.configure && (
                        <Link
                          href={`/sources/${src.configure}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          Configure
                        </Link>
                      )}
                      <button
                        onClick={() => handleSync(integration.id)}
                        disabled={syncing === integration.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      >
                        {syncing === integration.id ? 'Syncing...' : 'Sync now'}
                      </button>
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        className="text-xs px-3 py-1.5 rounded-lg text-red-500 border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(src.authorize)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
