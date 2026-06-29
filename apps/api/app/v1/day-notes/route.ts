import { NextRequest, NextResponse } from 'next/server';
import { db, dayNotes } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEN = 20000;

// GET /v1/day-notes?date=YYYY-MM-DD — the journal entry for that local day ('' if none).
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const date = request.nextUrl.searchParams.get('date') || '';
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date', code: 'INVALID_DATE' }, { status: 400 });
  }

  const [row] = await db
    .select({ content: dayNotes.content })
    .from(dayNotes)
    .where(and(eq(dayNotes.userId, userId), eq(dayNotes.date, date)))
    .limit(1);

  return NextResponse.json({ date, content: row?.content ?? '' });
}

// PUT /v1/day-notes — upsert the journal entry for a day. Body: { date, content }.
export async function PUT(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { date?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const date = typeof body.date === 'string' ? body.date : '';
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date', code: 'INVALID_DATE' }, { status: 400 });
  }
  const content = (typeof body.content === 'string' ? body.content : '').slice(0, MAX_LEN);

  await db
    .insert(dayNotes)
    .values({ userId, date, content })
    .onConflictDoUpdate({
      target: [dayNotes.userId, dayNotes.date],
      set: { content, updatedAt: new Date() },
    });

  return NextResponse.json({ date, content });
}
