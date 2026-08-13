'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';
import { GooglePlayBooksIcon } from '../../../components/source-badge';

interface Volume {
  volume_id: string;
  title: string;
  authors: string[];
  page_count: number | null;
  thumbnail: string | null;
  acquire_method: string;
  is_sample: boolean;
  tracked: boolean;
  progress: {
    page_label: string;
    page_kind: string;
    page_number: number | null;
    percent: number | null;
    read_at: string;
  } | null;
}

interface VolumesResponse {
  volumes: Volume[];
  last_synced_at: string | null;
}

// `PA` pages carry a printed number; `PT` pages do not, though both index into the
// volume. Word them differently so the label never claims a printed page the book
// does not have, while still giving the position.
function positionLabel(v: Volume): string {
  const p = v.progress;
  if (!p) return 'No bookmark yet';
  if (p.page_kind === 'front_matter') return 'In the front matter';
  if (p.page_number === null) return p.page_label;

  const noun = p.page_kind === 'body' ? 'Page' : 'Position';
  return v.page_count
    ? `${noun} ${p.page_number} of ${v.page_count}`
    : `${noun} ${p.page_number}`;
}

export default function GoogleBooksConfig() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<VolumesResponse>('/v1/integrations/google-books/volumes')
      .then((d) => setVolumes(d.volumes))
      .catch(() => setError('Could not load your library. Try reconnecting Google Play Books.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(volumeId: string) {
    // Optimistic: the list is the source of truth for what we send, so flip first.
    const next = volumes.map((v) => (v.volume_id === volumeId ? { ...v, tracked: !v.tracked } : v));
    setVolumes(next);
    setSaving(true);
    try {
      await apiFetch('/v1/integrations/google-books/volumes', {
        method: 'PUT',
        body: JSON.stringify({
          tracked_volume_ids: next.filter((v) => v.tracked).map((v) => v.volume_id),
        }),
      });
    } catch {
      setVolumes(volumes); // revert
      setError('Could not save. Your selection was not changed.');
    } finally {
      setSaving(false);
    }
  }

  const tracked = volumes.filter((v) => v.tracked);
  const started = tracked.filter((v) => v.progress);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded shimmer mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl shimmer" />
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
        <GooglePlayBooksIcon className="w-6 h-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Google Play Books</h1>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Progress comes from the bookmarks you leave while reading — Play Books does not expose a
        reading position any other way. Bookmark where you stop and it shows up here.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4 text-xs text-neutral-500">
        <span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{tracked.length}</span>{' '}
          of {volumes.length} tracked
        </span>
        <span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{started.length}</span>{' '}
          started
        </span>
        {saving && <span className="text-neutral-400">Saving…</span>}
      </div>

      <div className="space-y-3">
        {volumes.map((v, idx) => (
          <div
            key={v.volume_id}
            className={`p-4 card-modern rise ${v.tracked ? '' : 'opacity-55'}`}
            style={{ animationDelay: `${40 + idx * 50}ms` }}
          >
            <div className="flex items-start gap-3">
              {v.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumbnail}
                  alt=""
                  className="w-10 h-14 object-cover rounded flex-shrink-0 bg-neutral-100 dark:bg-neutral-800"
                />
              ) : (
                <div className="w-10 h-14 rounded flex-shrink-0 bg-neutral-100 dark:bg-neutral-800" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {v.authors.join(', ') || 'Unknown author'}
                      {v.is_sample && (
                        <span className="ml-2 text-[10px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                          Sample
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => toggle(v.volume_id)}
                    role="switch"
                    aria-checked={v.tracked}
                    aria-label={`${v.tracked ? 'Stop tracking' : 'Track'} ${v.title}`}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      v.tracked
                        ? 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        : 'border-transparent bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
                    }`}
                  >
                    {v.tracked ? 'Tracking' : 'Track'}
                  </button>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-600 dark:text-neutral-400">{positionLabel(v)}</span>
                    {v.progress?.percent !== null && v.progress?.percent !== undefined && (
                      <span className="font-medium tabular-nums">{v.progress.percent}%</span>
                    )}
                  </div>

                  {v.progress?.percent !== null && v.progress?.percent !== undefined ? (
                    <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-[width] duration-500"
                        style={{ width: `${Math.max(1.5, v.progress.percent)}%` }}
                      />
                    </div>
                  ) : null}

                  {v.progress && (
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Last read {new Date(v.progress.read_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
