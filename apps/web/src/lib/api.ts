/**
 * Base URL for API calls from the browser. Empty by default → requests are
 * same-origin and Next.js rewrites forward them to the API (see next.config.ts).
 * Set `NEXT_PUBLIC_API_URL` only to target the API on a separate origin.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type ApiInit = RequestInit & { noCache?: boolean };

const isBrowser = typeof window !== 'undefined';

// Browser-only GET cache with two jobs: (1) coalesce concurrent identical GETs into ONE
// request (e.g. Goals page + TodoSection both loading /v1/goals on mount); (2) reuse the
// cached body on a repeat GET within TTL_MS. Any mutation or `*-changed` event clears it,
// so a read after a change is always fresh. Never used server-side — a module-level
// cache there would leak across requests.
const TTL_MS = 2500;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function isGet(init?: ApiInit): boolean {
  return (init?.method ?? 'GET').toUpperCase() === 'GET';
}

// Clear the whole GET cache (cheap; guarantees no stale read after a write). In-flight
// requests are untouched, so their coalescing still holds.
export function invalidateApiCache(): void {
  cache.clear();
}

if (isBrowser) {
  for (const evt of [
    'baseline:goals-changed',
    'baseline:todos-changed',
    'baseline:categories-changed',
    'baseline:me-changed',
  ]) {
    window.addEventListener(evt, invalidateApiCache);
  }
  // Cross-tab: another tab changed something.
  window.addEventListener('storage', invalidateApiCache);
}

async function doFetch<T>(path: string, init?: ApiInit): Promise<T> {
  const { noCache: _noCache, ...rest } = init ?? {};
  void _noCache;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...rest.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function apiFetch<T>(path: string, init?: ApiInit): Promise<T> {
  const cacheable = isBrowser && isGet(init) && !init?.body && !init?.noCache;

  if (cacheable) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
    const pending = inflight.get(path);
    if (pending) return pending as Promise<T>;
    const p = doFetch<T>(path, init)
      .then((data) => {
        cache.set(path, { at: Date.now(), data });
        return data;
      })
      .finally(() => {
        inflight.delete(path);
      });
    inflight.set(path, p);
    return p as Promise<T>;
  }

  const result = await doFetch<T>(path, init);
  // A write changed server state — drop cached reads so the next GET is fresh.
  if (isBrowser && !isGet(init)) invalidateApiCache();
  return result;
}
