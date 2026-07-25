import { NextRequest, NextResponse } from 'next/server';
import { db, integrations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../lib/user';
import { revokeIntegrations } from '../../../../lib/revoke-integrations';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  // Read the tokens before clearing them so we can revoke the grant with the provider.
  const [existing] = await db
    .select({ provider: integrations.provider, accessToken: integrations.accessToken, refreshToken: integrations.refreshToken })
    .from(integrations)
    .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: 'Integration not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  await revokeIntegrations([existing]);

  const [row] = await db
    .update(integrations)
    .set({ status: 'disconnected', accessToken: null, refreshToken: null })
    .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
    .returning();

  return NextResponse.json({
    id: row.id,
    provider: row.provider,
    status: row.status,
    external_account_id: row.externalAccountId,
    connected_at: row.connectedAt,
    last_synced_at: row.lastSyncedAt,
  });
}
