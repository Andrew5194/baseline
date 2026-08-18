import { NextRequest, NextResponse } from 'next/server';
import { dayKeyInTz, computeDelta } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, isPeriod, offsetNow, parseOffset } from '../../../../../lib/period';
import { loadProgressSteps, loadBookmarkEvents, type ProgressStep } from '../../../../../lib/book-progress';

const round1 = (n: number) => Math.round(n * 10) / 10;
const within = (s: ProgressStep[], from: Date, to: Date) => s.filter((v) => v.at >= from && v.at < to);
const pages = (s: ProgressStep[]) => s.reduce((a, v) => a + v.pages, 0);
const percent = (s: ProgressStep[]) => s.reduce((a, v) => a + v.percent, 0);

// GET /v1/metrics/books/overview?period=week|month|year — reading metrics derived
// from bookmark positions, with a delta vs the same elapsed slice of the prior period.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const periodParam = request.nextUrl.searchParams.get('period') || 'week';
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const offset = parseOffset(request.nextUrl.searchParams.get('offset'));
  const b = periodBounds(periodParam, offsetNow(periodParam, now, tz, offset), tz);
  const currEnd = now < b.end ? now : b.end;
  const elapsedMs = currEnd.getTime() - b.start.getTime();
  const prevEnd = new Date(b.prevStart.getTime() + elapsedMs);

  // Steps need the whole trail, not just the window — see loadProgressSteps.
  const [steps, marks] = await Promise.all([
    loadProgressSteps(userId, currEnd),
    loadBookmarkEvents(userId, b.prevStart, currEnd),
  ]);

  const currSteps = within(steps, b.start, currEnd);
  const prevSteps = within(steps, b.prevStart, prevEnd);
  const marksIn = (from: Date, to: Date) => marks.filter((m) => m.at >= from && m.at < to);
  const currMarks = marksIn(b.start, currEnd);
  const prevMarks = marksIn(b.prevStart, prevEnd);

  const readingDays = (m: typeof marks) => new Set(m.map((v) => dayKeyInTz(v.at, tz))).size;
  const booksRead = (m: typeof marks) => new Set(m.map((v) => v.volumeId)).size;
  const mk = (cv: number, pv: number, unit: string) => ({ value: cv, delta: computeDelta(cv, pv), unit, prev: pv });

  return NextResponse.json({
    period: periodParam,
    metrics: {
      pages_advanced: mk(pages(currSteps), pages(prevSteps), 'pages'),
      progress_gained: mk(round1(percent(currSteps)), round1(percent(prevSteps)), '%'),
      books_read: mk(booksRead(currMarks), booksRead(prevMarks), 'books'),
      reading_days: mk(readingDays(currMarks), readingDays(prevMarks), 'days'),
    },
  });
}
