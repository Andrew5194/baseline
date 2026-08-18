import { db, events } from '@baseline/db';
import { eq, and, lt } from 'drizzle-orm';

const SOURCE = 'google_books';

export interface ProgressStep {
  /** When the later bookmark of the pair was placed. */
  at: Date;
  volumeId: string;
  /** Pages advanced since the previous bookmark in this book. */
  pages: number;
}

interface Bookmark {
  at: Date;
  volumeId: string;
  kind: string;
  number: number | null;
}

/**
 * Turn a book's bookmark trail into per-step advances.
 *
 * Play Books never reports pages read, but consecutive bookmarks in the same book
 * do: PA5 followed by PA6 is one page. Each step is credited to the *later*
 * bookmark, since that is when the reading had happened by.
 *
 * Deliberate limits:
 *  - The first bookmark in a book scores nothing. We do not know where you started,
 *    and assuming page one would invent a chunk of reading.
 *  - Steps between different page-number schemes score nothing. PR8 to PA5 is real
 *    reading, but Roman front matter and Arabic body pages are separate scales and
 *    subtracting one from the other is meaningless.
 *  - Backwards steps score zero rather than negative — re-reading is not un-reading.
 *
 * Deleted bookmarks still count: a removed bookmark marks a position you reached,
 * and dropping them would erase most of the trail.
 */
export function stepsFromBookmarks(bookmarks: Bookmark[]): ProgressStep[] {
  const byVolume = new Map<string, Bookmark[]>();
  for (const b of bookmarks) {
    const list = byVolume.get(b.volumeId);
    if (list) list.push(b);
    else byVolume.set(b.volumeId, [b]);
  }

  const steps: ProgressStep[] = [];
  for (const [volumeId, list] of byVolume) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (prev.kind !== curr.kind) continue;

      // A percentage would just be this over the book's page count — the same
      // number scaled — so pages are the only thing worth carrying.
      const pages =
        prev.number !== null && curr.number !== null ? Math.max(0, curr.number - prev.number) : 0;
      if (pages === 0) continue;

      steps.push({ at: curr.at, volumeId, pages });
    }
  }

  return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Every progress step up to `end`.
 *
 * Reads the whole trail rather than only the reporting window: the first bookmark
 * inside a window needs its predecessor from before it, or a week that continues a
 * book already in progress would score zero for its first session.
 */
export async function loadProgressSteps(userId: string, end: Date): Promise<ProgressStep[]> {
  const rows = await db
    .select({ occurredAt: events.occurredAt, payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.source, SOURCE), lt(events.occurredAt, end)));

  const bookmarks: Bookmark[] = [];
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const volumeId = p.volume_id as string | undefined;
    if (!volumeId) continue;
    bookmarks.push({
      at: r.occurredAt,
      volumeId,
      kind: (p.page_kind as string) ?? 'unknown',
      number: (p.page_number ?? null) as number | null,
    });
  }

  return stepsFromBookmarks(bookmarks);
}

/** Bookmarks themselves, for metrics that count events rather than advances. */
export async function loadBookmarkEvents(
  userId: string,
  start: Date,
  end: Date,
): Promise<Array<{ at: Date; volumeId: string }>> {
  const rows = await db
    .select({ occurredAt: events.occurredAt, payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.source, SOURCE), lt(events.occurredAt, end)));

  return rows
    .filter((r) => r.occurredAt >= start)
    .map((r) => ({
      at: r.occurredAt,
      volumeId: ((r.payload ?? {}) as Record<string, unknown>).volume_id as string,
    }))
    .filter((r) => Boolean(r.volumeId));
}
