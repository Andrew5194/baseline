import { NextRequest, NextResponse } from 'next/server';
import { db, integrations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

export async function GET() {
  const userId = await getCurrentUserId();

  const rows = await db
    .select({
      id: integrations.id,
      provider: integrations.provider,
      status: integrations.status,
      externalAccountId: integrations.externalAccountId,
      connectedAt: integrations.connectedAt,
      lastSyncedAt: integrations.lastSyncedAt,
    })
    .from(integrations)
    .where(eq(integrations.userId, userId));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      status: r.status,
      external_account_id: r.externalAccountId,
      connected_at: r.connectedAt,
      last_synced_at: r.lastSyncedAt,
    })),
  );
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  if (!body.provider || !['github', 'gcal'].includes(body.provider)) {
    return NextResponse.json(
      { error: 'Invalid provider', code: 'INVALID_PROVIDER' },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(integrations)
    .values({
      userId,
      provider: body.provider,
      status: 'connected',
    })
    .onConflictDoNothing()
    .returning();

  if (!row) {
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, body.provider)));
    return NextResponse.json(
      {
        id: existing.id,
        provider: existing.provider,
        status: existing.status,
        external_account_id: existing.externalAccountId,
        connected_at: existing.connectedAt,
        last_synced_at: existing.lastSyncedAt,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      id: row.id,
      provider: row.provider,
      status: row.status,
      external_account_id: row.externalAccountId,
      connected_at: row.connectedAt,
      last_synced_at: row.lastSyncedAt,
    },
    { status: 201 },
  );
}
