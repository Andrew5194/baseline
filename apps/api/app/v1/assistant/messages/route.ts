import { NextResponse } from 'next/server';
import { db, assistantMessages } from '@baseline/db';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

// The stored conversation. Not gated on Pro: the messages are the user's own, so a
// lapsed plan should still be able to read and export what it already said.

/** How much history is restored. Older messages stay in the table for export. */
const LIMIT = 100;

export async function GET() {
  const userId = await getCurrentUserId();

  // Newest-first with a limit, then flipped, so a long history returns the most
  // recent window rather than the oldest one.
  const rows = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.userId, userId))
    .orderBy(desc(assistantMessages.seq))
    .limit(LIMIT);

  const data = rows.reverse().map((m) => ({
    id: m.id,
    role: m.role,
    text: m.content,
    suggestions: m.suggestions ?? undefined,
    created_at: m.createdAt,
  }));

  return NextResponse.json({ data });
}

/** Start a fresh conversation. */
export async function DELETE() {
  const userId = await getCurrentUserId();
  await db.delete(assistantMessages).where(eq(assistantMessages.userId, userId));
  return new NextResponse(null, { status: 204 });
}
