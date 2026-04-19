import { NextRequest, NextResponse } from 'next/server';
import { db, integrations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../../../lib/user';
import { syncIntegration } from '../../../../../lib/ingestion';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.id, id), eq(integrations.userId, userId)));

  if (!integration) {
    return NextResponse.json(
      { error: 'Integration not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  if (integration.status !== 'connected') {
    return NextResponse.json(
      { error: 'Integration is not connected', code: 'NOT_CONNECTED' },
      { status: 400 },
    );
  }

  try {
    const eventsCount = await syncIntegration(id);
    return NextResponse.json({ status: 'ok', events_count: eventsCount });
  } catch {
    return NextResponse.json(
      { error: 'Sync failed', code: 'SYNC_FAILED' },
      { status: 500 },
    );
  }
}
