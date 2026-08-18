import { NextRequest, NextResponse } from 'next/server';
import { dayKeyInTz } from '@baseline/metrics';
import { getCurrentUserId, getUserTimezone } from '../../../../../lib/user';
import { periodBounds, periodBuckets, isPeriod, offsetNow, parseOffset } from '../../../../../lib/period';
import { loadProgressSteps, loadBookmarkEvents } from '../../../../../lib/book-progress';

const METRICS = ['pages_advanced', 'progress_gained', 'books_read', 'reading_days'];
const round1 = (n: number) => Math.round(n * 10) / 10;

// GET /v1/metrics/books/timeseries?metric=&period= — the metric per natural bucket
// across the period, for the bar chart.
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const tz = await getUserTimezone(userId);
  const params = request.nextUrl.searchParams;
  const metricsParam = params.get('metrics');
  const metric = params.get('metric') || '';
  const periodParam = params.get('period') || 'week';

  const requested = metricsParam ? metricsParam.split(',').filter(Boolean) : metric ? [metric] : [];
  if (requested.length === 0 || requested.some((mk) => !METRICS.includes(mk))) {
    return NextResponse.json({ error: 'Invalid metric', code: 'INVALID_METRIC' }, { status: 400 });
  }
  if (!isPeriod(periodParam)) {
    return NextResponse.json({ error: 'Invalid period', code: 'INVALID_PERIOD' }, { status: 400 });
  }

  const now = new Date();
  const offset = parseOffset(params.get('offset'));
  const b = periodBounds(periodParam, offsetNow(periodParam, now, tz, offset), tz);
  const buckets = periodBuckets(periodParam, b.start, b.end, tz);

  const [steps, marks] = await Promise.all([
    loadProgressSteps(userId, b.end),
    loadBookmarkEvents(userId, b.start, b.end),
  ]);

  const valueFor = (mk: string, from: Date, to: Date): number => {
    const s = steps.filter((v) => v.at >= from && v.at < to);
    const m = marks.filter((v) => v.at >= from && v.at < to);
    switch (mk) {
      case 'pages_advanced':
        return s.reduce((a, v) => a + v.pages, 0);
      case 'progress_gained':
        return round1(s.reduce((a, v) => a + v.percent, 0));
      case 'books_read':
        return new Set(m.map((v) => v.volumeId)).size;
      case 'reading_days':
        return new Set(m.map((v) => dayKeyInTz(v.at, tz))).size;
      default:
        return 0;
    }
  };

  const series: Record<string, Array<{ date: string; value: number }>> = {};
  for (const mk of requested) {
    series[mk] = buckets.map((bk) => ({
      date: dayKeyInTz(bk.start, tz),
      value: valueFor(mk, bk.start, bk.end),
    }));
  }

  if (metricsParam) {
    return NextResponse.json({ period: periodParam, series });
  }
  return NextResponse.json({ metric: requested[0], period: periodParam, data: series[requested[0]] });
}
