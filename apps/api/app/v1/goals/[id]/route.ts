import { NextRequest, NextResponse } from 'next/server';
import { db, goals } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

// PATCH /v1/goals/[id] — update a goal's target.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  let body: { target?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  if (typeof body.target !== 'number' || !(body.target > 0)) {
    return NextResponse.json({ error: 'target must be greater than 0', code: 'INVALID_TARGET' }, { status: 400 });
  }

  const [row] = await db
    .update(goals)
    .set({ target: body.target })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning({ id: goals.id });

  if (!row) {
    return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /v1/goals/[id] — remove a goal.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning({ id: goals.id });

  if (!row) {
    return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
