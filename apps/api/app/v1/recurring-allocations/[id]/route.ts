import { NextRequest, NextResponse } from 'next/server';
import { db, recurringAllocations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

// DELETE /v1/recurring-allocations/{id} — remove a recurring allocation the user owns.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .delete(recurringAllocations)
    .where(and(eq(recurringAllocations.id, id), eq(recurringAllocations.userId, userId)))
    .returning({ id: recurringAllocations.id });

  if (!row) {
    return NextResponse.json({ error: 'Allocation not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ id: row.id, deleted: true });
}
