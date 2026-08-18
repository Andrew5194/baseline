'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

interface Repo {
  name: string;
  is_private: boolean;
  is_fork: boolean;
  is_archived: boolean;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
  tracked: boolean;
  event_count: number;
}

interface ReposResponse {
  repos: Repo[];
  last_synced_at: string | null;
}

type Visibility = 'all' | 'public' | 'private';

export default function GitHubConfig() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('all');

  useEffect(() => {
    apiFetch<ReposResponse>('/v1/integrations/github/repos')
      .then((d) => setRepos(d.repos))
      .catch(() => setError('Could not load your repositories. Try reconnecting GitHub.'))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: Repo[]) {
    const previous = repos;
    setRepos(next);
    setSaving(true);
    try {
      await apiFetch('/v1/integrations/github/repos', {
        method: 'PUT',
        body: JSON.stringify({
          tracked_repos: next.filter((r) => r.tracked).map((r) => r.name),
        }),
      });
    } catch {
      setRepos(previous);
      setError('Could not save. Your selection was not changed.');
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos.filter((r) => {
      if (visibility === 'public' && r.is_private) return false;
      if (visibility === 'private' && !r.is_private) return false;
      return !q || r.name.toLowerCase().includes(q);
    });
  }, [repos, query, visibility]);

  const trackedCount = repos.filter((r) => r.tracked).length;
  // Bulk actions apply to what is on screen, so a search plus "Track all" is how you
  // select a subset without clicking through every row.
  const allVisibleTracked = visible.length > 0 && visible.every((r) => r.tracked);

  function toggleAllVisible() {
    const names = new Set(visible.map((r) => r.name));
    persist(repos.map((r) => (names.has(r.name) ? { ...r, tracked: !allVisibleTracked } : r)));
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="h-8 w-40 bg-neutral-200 dark:bg-neutral-800 rounded shimmer mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <Link
        href="/sources"
        className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
      >
        ← Sources
      </Link>

      <div className="flex items-center gap-3 mt-3 mb-1">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <h1 className="text-2xl font-semibold tracking-tight">GitHub</h1>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Commits, merged pull requests and reviews from the repositories you choose. Private repos
        are included — your GitHub grant already covers them.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        <div className="flex gap-1">
          {(['all', 'public', 'private'] as Visibility[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`text-xs px-3 py-2 rounded-lg border transition-colors capitalize ${
                visibility === v
                  ? 'border-transparent bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                  : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs text-neutral-500">
        <span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{trackedCount}</span>{' '}
          of {repos.length} tracked
          {saving && <span className="ml-2 text-neutral-400">Saving…</span>}
        </span>
        {visible.length > 0 && (
          <button
            onClick={toggleAllVisible}
            className="text-xs px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            {allVisibleTracked ? 'Untrack' : 'Track'} {visible.length === repos.length ? 'all' : 'these'}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">No repositories match.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <div
              key={r.name}
              className={`p-3 card-modern flex items-center gap-3 ${r.tracked ? '' : 'opacity-55'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  {r.is_private && (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Private
                    </span>
                  )}
                  {r.is_fork && (
                    <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                      Fork
                    </span>
                  )}
                  {r.is_archived && (
                    <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate">
                  {[
                    r.language,
                    r.event_count > 0 ? `${r.event_count} event${r.event_count === 1 ? '' : 's'}` : null,
                    r.pushed_at ? `pushed ${new Date(r.pushed_at).toLocaleDateString()}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No activity recorded'}
                </p>
              </div>

              <button
                onClick={() => persist(repos.map((x) => (x.name === r.name ? { ...x, tracked: !x.tracked } : x)))}
                role="switch"
                aria-checked={r.tracked}
                aria-label={`${r.tracked ? 'Stop tracking' : 'Track'} ${r.name}`}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  r.tracked
                    ? 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    : 'border-transparent bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                }`}
              >
                {r.tracked ? 'Tracking' : 'Track'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
