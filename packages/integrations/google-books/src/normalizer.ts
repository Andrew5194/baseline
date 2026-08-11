import { EVENT_TYPES } from '@baseline/events';
import type { BooksAnnotation, BooksVolume } from './client';

interface EventRow {
  userId: string;
  source: string;
  sourceId: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export type PageKind = 'body' | 'front_matter' | 'reflowable' | 'unknown';

export interface ParsedPage {
  /** The raw label as Google returns it, e.g. "PA25". */
  label: string;
  kind: PageKind;
  /** The number after the prefix, when there is one. */
  number: number | null;
}

/**
 * Google page ids carry a prefix that decides whether the number means anything.
 *
 *   PA25  a printed body page. Comparable to pageCount, so a percentage is real.
 *   PR7   Roman-numbered front matter. Sits before page 1, so it reads as 0%,
 *         NOT 7/pageCount.
 *   PT64  a position in reflowable text with no printed-page equivalent. Dividing
 *         it by pageCount invents a number, so we refuse to.
 *
 * The prefix is not predictable from volume metadata — observed volumes with
 * identical readingModes produced PA in one case and PT in another — so this
 * parses whatever arrives rather than deciding in advance.
 */
export function parsePageId(pageId: string): ParsedPage {
  const match = /^(P[A-Z])(\d+)$/.exec(pageId);
  if (!match) return { label: pageId, kind: 'unknown', number: null };

  const [, prefix, digits] = match;
  const number = Number(digits);
  const kind: PageKind =
    prefix === 'PA' ? 'body' : prefix === 'PR' ? 'front_matter' : prefix === 'PT' ? 'reflowable' : 'unknown';

  return { label: pageId, kind, number };
}

/**
 * How far through the book this position is, or null when that cannot be known.
 *
 * Only body pages are measurable. Front matter is 0 by definition. Reflowable and
 * unknown positions return null so the UI shows a position instead of a number
 * that looks authoritative and isn't.
 */
export function progressPercent(page: ParsedPage, pageCount: number | null): number | null {
  if (page.kind === 'front_matter') return 0;
  if (page.kind !== 'body' || page.number === null) return null;
  if (!pageCount || pageCount <= 0) return null;
  return Math.min(100, Math.round((page.number / pageCount) * 1000) / 10);
}

/**
 * Bookmarks become reading events — one per bookmark, at the moment it was placed.
 *
 * Deleted bookmarks are kept. Moving a bookmark forward deletes the old one, and
 * those tombstones are the reading trail: without them you would only ever see the
 * latest position instead of the path through the book.
 */
export function normalizeBookmarks(
  annotations: BooksAnnotation[],
  volume: BooksVolume,
  userId: string,
): EventRow[] {
  const rows: EventRow[] = [];

  for (const a of annotations) {
    // No page id means no position — nothing to record.
    const pageId = a.pageIds[0];
    if (!pageId) continue;

    const page = parsePageId(pageId);
    const percent = progressPercent(page, volume.pageCount);

    rows.push({
      userId,
      source: 'google_books',
      sourceId: a.id,
      eventType: EVENT_TYPES.BOOK_PROGRESS,
      occurredAt: new Date(a.created),
      payload: {
        category: 'Reading',
        volume_id: volume.id,
        title: volume.title,
        authors: volume.authors,
        page_label: page.label,
        page_kind: page.kind,
        page_number: page.number,
        page_count: volume.pageCount,
        percent,
        layer: a.layerId,
        // A sample reports the full book's pageCount while containing an excerpt,
        // so its percentage understates how far through the sample you are.
        is_sample: volume.acquireMethod === 'SAMPLE',
        acquire_method: volume.acquireMethod,
        deleted: a.deleted,
      },
    });
  }

  return rows;
}
