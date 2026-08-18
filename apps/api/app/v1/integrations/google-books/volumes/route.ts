import { NextRequest, NextResponse } from 'next/server';
import { db, integrations, events } from '@baseline/db';
import { eq, and, desc } from 'drizzle-orm';
import { fetchLibrary } from '@baseline/integrations-google-books';
import { getCurrentUserId } from '../../../../../lib/user';
import { ensureGoogleAccessToken } from '../../../../../lib/ingestion';

const PROVIDER = 'google_books';

interface Settings {
  /** Volume ids to sync. Absent means every book — so connecting a source and
   *  never opening this page keeps collecting everything. */
  tracked_volume_ids?: string[];
}

async function loadIntegration(userId: string) {
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, PROVIDER)));
  return row;
}

/** Latest non-deleted bookmark per volume — the current position in each book. */
async function currentPositions(userId: string) {
  const rows = await db
    .select({ occurredAt: events.occurredAt, payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.source, PROVIDER)))
    .orderBy(desc(events.occurredAt));

  const latest = new Map<string, { occurredAt: Date; payload: Record<string, unknown> }>();
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const volumeId = p.volume_id as string | undefined;
    // A removed bookmark marks somewhere you read, but it is not where you are now.
    if (!volumeId || p.deleted === true || latest.has(volumeId)) continue;
    latest.set(volumeId, { occurredAt: r.occurredAt, payload: p });
  }
  return latest;
}

export async function GET() {
  const userId = await getCurrentUserId();
  const integration = await loadIntegration(userId);

  if (!integration || integration.status !== 'connected') {
    return NextResponse.json(
      { error: 'Google Books not connected', code: 'NOT_CONNECTED' },
      { status: 404 },
    );
  }

  const settings = (integration.settings ?? {}) as Settings;
  const tracked = settings.tracked_volume_ids;

  let token: string;
  try {
    token = await ensureGoogleAccessToken(integration);
  } catch {
    return NextResponse.json(
      { error: 'Reconnect Google Books', code: 'TOKEN_INVALID' },
      { status: 409 },
    );
  }

  const [library, positions] = await Promise.all([fetchLibrary(token), currentPositions(userId)]);

  return NextResponse.json({
    volumes: library.map((v) => {
      const at = positions.get(v.id);
      const p = at?.payload;
      return {
        volume_id: v.id,
        title: v.title,
        authors: v.authors,
        page_count: v.pageCount,
        thumbnail: v.thumbnail,
        acquire_method: v.acquireMethod,
        is_sample: v.acquireMethod === 'SAMPLE',
        // Absent settings means everything is tracked.
        tracked: tracked ? tracked.includes(v.id) : true,
        progress: p
          ? {
              page_label: p.page_label as string,
              page_kind: p.page_kind as string,
              page_number: (p.page_number ?? null) as number | null,
              percent: (p.percent ?? null) as number | null,
              read_at: at!.occurredAt,
            }
          : null,
      };
    }),
    last_synced_at: integration.lastSyncedAt,
  });
}

export async function PUT(request: NextRequest) {
  const userId = await getCurrentUserId();
  const integration = await loadIntegration(userId);

  if (!integration || integration.status !== 'connected') {
    return NextResponse.json(
      { error: 'Google Books not connected', code: 'NOT_CONNECTED' },
      { status: 404 },
    );
  }

  let body: { tracked_volume_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }

  const ids = body.tracked_volume_ids;
  if (!Array.isArray(ids) || ids.some((v) => typeof v !== 'string')) {
    return NextResponse.json(
      { error: 'tracked_volume_ids must be an array of strings', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const settings = { ...((integration.settings ?? {}) as Settings), tracked_volume_ids: ids as string[] };
  await db.update(integrations).set({ settings }).where(eq(integrations.id, integration.id));

  return NextResponse.json({ tracked_volume_ids: ids });
}
