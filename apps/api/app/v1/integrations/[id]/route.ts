import { NextRequest, NextResponse } from 'next/server';
import { db, integrations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [row] = await db
    .update(integrations)
    .set({ status: 'disconnected', accessToken: null, refreshToken: null })
    .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: 'Integration not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: row.id,
    provider: row.provider,
    status: row.status,
    external_account_id: row.externalAccountId,
    connected_at: row.connectedAt,
    last_synced_at: row.lastSyncedAt,
  });
}
