const BOOKS_API = 'https://books.googleapis.com/books/v1';

// Play Books progress is not where the documentation suggests it is:
//
//   /mylibrary/readingpositions/{id}  returns HTTP 501 for every volume, including
//     public-domain ones. It is in the discovery document but disabled server-side.
//   /mylibrary/bookshelves            reports 0 volumes for everything. Play Books
//     content never appears there.
//   userInfo.readingPosition          always null; userInfo.updated tracks
//     acquisition, not reading.
//
// What does work is bookmarks, which arrive as annotations carrying a page id and a
// timestamp. That is the only reading signal the API exposes, so it is what we read.

export interface BooksVolume {
  id: string;
  title: string;
  authors: string[];
  pageCount: number | null;
  /** How it entered the library — PURCHASED, SAMPLE, PUBLIC_DOMAIN, … */
  acquireMethod: string;
  thumbnail: string | null;
}

export interface BooksAnnotation {
  id: string;
  volumeId: string;
  layerId: string;
  /** e.g. ["PA25"] — see normalizer for what the prefixes mean. */
  pageIds: string[];
  created: string;
  updated: string;
  deleted: boolean;
}

// Every way a volume can enter a library. `mybooks` requires an acquireMethod —
// omitting it returns totalItems: 0 rather than everything, which reads as an
// empty library and is easy to misdiagnose.
const ACQUIRE_METHODS = [
  'PURCHASED',
  'PREORDERED',
  'RENTED',
  'PREVIOUSLY_RENTED',
  'SAMPLE',
  'UPLOADED',
  'PUBLIC_DOMAIN',
  'FAMILY_SHARED',
] as const;

async function booksGet(token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BOOKS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('GOOGLE_TOKEN_INVALID');
  if (!res.ok) throw new Error(`Google Books API error: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Every volume in the user's library, across all acquisition methods. */
export async function fetchLibrary(token: string): Promise<BooksVolume[]> {
  const byId = new Map<string, BooksVolume>();

  for (const method of ACQUIRE_METHODS) {
    const data = await booksGet(
      token,
      `/volumes/mybooks?acquireMethod=${method}&maxResults=40`,
    );
    for (const item of (data.items as Array<Record<string, never>>) ?? []) {
      const v = item as unknown as {
        id: string;
        volumeInfo?: {
          title?: string;
          authors?: string[];
          pageCount?: number;
          imageLinks?: { thumbnail?: string };
        };
      };
      if (!v.id || byId.has(v.id)) continue;
      byId.set(v.id, {
        id: v.id,
        title: v.volumeInfo?.title ?? 'Untitled',
        authors: v.volumeInfo?.authors ?? [],
        pageCount: v.volumeInfo?.pageCount ?? null,
        acquireMethod: method,
        thumbnail: v.volumeInfo?.imageLinks?.thumbnail ?? null,
      });
    }
  }

  return [...byId.values()];
}

/**
 * Bookmarks for one volume, changed since `since`.
 *
 * volumeId is effectively required — every call without it returns 400, so there
 * is no library-wide incremental sync and we poll per volume.
 *
 * showDeleted is on because deleting a bookmark leaves a tombstone that still
 * carries its page and timestamp. Those tombstones are how a reading trail is
 * reconstructed when someone moves their bookmark forward as they read.
 */
export async function fetchBookmarks(
  token: string,
  volumeId: string,
  since: Date,
): Promise<BooksAnnotation[]> {
  const params = new URLSearchParams({
    volumeId,
    updatedMin: since.toISOString(),
    showDeleted: 'true',
    maxResults: '40',
  });

  const out: BooksAnnotation[] = [];
  let pageToken: string | undefined;

  do {
    if (pageToken) params.set('pageToken', pageToken);
    const data = await booksGet(token, `/mylibrary/annotations?${params.toString()}`);

    for (const item of (data.items as Array<Record<string, unknown>>) ?? []) {
      const a = item as {
        id?: string;
        volumeId?: string;
        layerId?: string;
        pageIds?: string[];
        created?: string;
        updated?: string;
        deleted?: boolean;
      };
      if (!a.id || !a.created) continue;
      out.push({
        id: a.id,
        volumeId: a.volumeId ?? volumeId,
        layerId: a.layerId ?? 'unknown',
        pageIds: a.pageIds ?? [],
        created: a.created,
        updated: a.updated ?? a.created,
        deleted: a.deleted ?? false,
      });
    }

    pageToken = data.nextPageToken as string | undefined;
  } while (pageToken);

  return out;
}
