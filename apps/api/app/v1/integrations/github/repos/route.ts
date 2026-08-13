import { NextRequest, NextResponse } from 'next/server';
import { db, integrations, events } from '@baseline/db';
import { eq, and, desc } from 'drizzle-orm';
import { fetchRepositories } from '@baseline/integrations-github';
import { getCurrentUserId } from '../../../../../lib/user';

const PROVIDER = 'github';

interface Settings {
  /** `owner/name` repos to sync. Absent means all of them. */
  tracked_repos?: string[];
}

async function loadIntegration(userId: string) {
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, PROVIDER)));
  return row;
}

/** Event counts per repo, so the page can show what each one has contributed. */
async function eventCountsByRepo(userId: string) {
  const rows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.source, PROVIDER)))
    .orderBy(desc(events.occurredAt));

  const counts = new Map<string, number>();
  for (const r of rows) {
    const repo = (r.payload as Record<string, unknown> | null)?.repo as string | undefined;
    if (repo) counts.set(repo, (counts.get(repo) ?? 0) + 1);
  }
  return counts;
}

export async function GET() {
  const userId = await getCurrentUserId();
  const integration = await loadIntegration(userId);

  if (!integration || integration.status !== 'connected' || !integration.accessToken) {
    return NextResponse.json(
      { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
      { status: 404 },
    );
  }

  const tracked = ((integration.settings ?? {}) as Settings).tracked_repos;

  let repos;
  try {
    repos = await fetchRepositories(integration.accessToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'GITHUB_TOKEN_INVALID') {
      return NextResponse.json(
        { error: 'Reconnect GitHub', code: 'TOKEN_INVALID' },
        { status: 409 },
      );
    }
    throw err;
  }

  const counts = await eventCountsByRepo(userId);

  return NextResponse.json({
    repos: repos.map((r) => ({
      name: r.nameWithOwner,
      is_private: r.isPrivate,
      is_fork: r.isFork,
      is_archived: r.isArchived,
      description: r.description,
      language: r.primaryLanguage,
      pushed_at: r.pushedAt,
      // Absent settings means everything is tracked.
      tracked: tracked ? tracked.includes(r.nameWithOwner) : true,
      event_count: counts.get(r.nameWithOwner) ?? 0,
    })),
    last_synced_at: integration.lastSyncedAt,
  });
}

export async function PUT(request: NextRequest) {
  const userId = await getCurrentUserId();
  const integration = await loadIntegration(userId);

  if (!integration || integration.status !== 'connected') {
    return NextResponse.json(
      { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
      { status: 404 },
    );
  }

  let body: { tracked_repos?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }

  const names = body.tracked_repos;
  if (!Array.isArray(names) || names.some((v) => typeof v !== 'string')) {
    return NextResponse.json(
      { error: 'tracked_repos must be an array of strings', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const settings = { ...((integration.settings ?? {}) as Settings), tracked_repos: names as string[] };
  await db.update(integrations).set({ settings }).where(eq(integrations.id, integration.id));

  return NextResponse.json({ tracked_repos: names });
}
