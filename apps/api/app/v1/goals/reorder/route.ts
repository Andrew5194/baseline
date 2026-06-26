import { NextRequest, NextResponse } from 'next/server';
import { db, goals } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

// POST /v1/goals/reorder — persist a new manual order. Body: { ids: string[] } in
// the desired top-to-bottom order; each goal's position is set to its index.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids is required', code: 'INVALID_BODY' }, { status: 400 });
  }

  await Promise.all(
    ids.map((id, index) =>
      db.update(goals).set({ position: index }).where(and(eq(goals.id, id), eq(goals.userId, userId))),
    ),
  );

  return NextResponse.json({ ok: true });
}
