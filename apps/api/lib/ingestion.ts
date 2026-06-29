import { db, integrations, events } from '@baseline/db';
import { eq, type InferSelectModel } from 'drizzle-orm';
import {
  fetchUserCommits,
  fetchUserPullRequests,
  fetchUserReviews,
  normalizeCommits,
  normalizePullRequests,
  normalizeReviews,
} from '@baseline/integrations-github';
import {
  refreshAccessToken,
  fetchPrimaryCalendar,
  fetchCalendarEvents,
  normalizeCalendarEvents,
} from '@baseline/integrations-google-calendar';

type Integration = InferSelectModel<typeof integrations>;

export async function syncIntegration(integrationId: string): Promise<number> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId));

  if (!integration || integration.status !== 'connected') {
    throw new Error('Integration not connected');
  }

  if (integration.provider === 'google_calendar') {
    return syncGoogleCalendar(integration);
  }

  if (!integration.accessToken) {
    throw new Error('Integration not connected or missing token');
  }

  const username = integration.externalAccountId;
  if (!username) {
    throw new Error('No GitHub username on integration');
  }

  // Incremental window. We re-scan an overlap before lastSyncedAt rather than
  // trusting the cursor exactly: GitHub's contributionsCollection graph (used to
  // enumerate repos in client.ts) lags behind freshly-pushed commits, so a narrow
  // "since last run" window silently drops just-pushed events — and because the
  // cursor advances to now() unconditionally, they were never retried. The overlap
  // makes each run self-healing; onConflictDoNothing dedupes the re-scanned rows.
  const FULL_BACKFILL_MS = 90 * 24 * 60 * 60 * 1000;
  const OVERLAP_MS = 3 * 24 * 60 * 60 * 1000;
  const since = integration.lastSyncedAt
    ? new Date(integration.lastSyncedAt.getTime() - OVERLAP_MS)
    : new Date(Date.now() - FULL_BACKFILL_MS);
  const startTime = Date.now();
  let totalEvents = 0;

  try {
    const [commits, prs, reviews] = await Promise.all([
      fetchUserCommits(integration.accessToken, username, since),
      fetchUserPullRequests(integration.accessToken, username, since),
      fetchUserReviews(integration.accessToken, username, since),
    ]);

    const allRows = [
      ...normalizeCommits(commits, integration.userId),
      ...normalizePullRequests(prs, integration.userId),
      ...normalizeReviews(reviews, integration.userId),
    ];

    if (allRows.length > 0) {
      // Insert in batches of 100
      for (let i = 0; i < allRows.length; i += 100) {
        const batch = allRows.slice(i, i + 100);
        await db.insert(events).values(batch).onConflictDoNothing();
      }
    }

    totalEvents = allRows.length;

    await db
      .update(integrations)
      .set({ lastSyncedAt: new Date(), status: 'connected' })
      .where(eq(integrations.id, integrationId));

    console.log(
      JSON.stringify({
        msg: 'sync_complete',
        integration_id: integrationId,
        provider: 'github',
        events: totalEvents,
        duration_ms: Date.now() - startTime,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message === 'GITHUB_TOKEN_INVALID') {
      await db
        .update(integrations)
        .set({ status: 'error' })
        .where(eq(integrations.id, integrationId));
    }

    console.error(
      JSON.stringify({
        msg: 'sync_failed',
        integration_id: integrationId,
        error: message,
        duration_ms: Date.now() - startTime,
      }),
    );
    throw err;
  }

  return totalEvents;
}

// Return a valid Google access token, refreshing (and persisting) it first if the
// stored one is missing or within 60s of expiry.
async function ensureGoogleAccessToken(integration: Integration): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }

  const buffer = 60 * 1000;
  const stillValid =
    integration.accessToken &&
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() > Date.now() + buffer;
  if (stillValid && integration.accessToken) {
    return integration.accessToken;
  }

  if (!integration.refreshToken) {
    throw new Error('GOOGLE_TOKEN_INVALID');
  }

  const refreshed = await refreshAccessToken(clientId, clientSecret, integration.refreshToken);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await db
    .update(integrations)
    .set({ accessToken: refreshed.access_token, tokenExpiresAt })
    .where(eq(integrations.id, integration.id));

  return refreshed.access_token;
}

async function syncGoogleCalendar(integration: Integration): Promise<number> {
  const FULL_BACKFILL_MS = 90 * 24 * 60 * 60 * 1000;
  const OVERLAP_MS = 3 * 24 * 60 * 60 * 1000;
  const since = integration.lastSyncedAt
    ? new Date(integration.lastSyncedAt.getTime() - OVERLAP_MS)
    : new Date(Date.now() - FULL_BACKFILL_MS);
  const startTime = Date.now();

  try {
    const token = await ensureGoogleAccessToken(integration);
    const calendar = await fetchPrimaryCalendar(token);
    const calEvents = await fetchCalendarEvents(token, since);
    const rows = normalizeCalendarEvents(calEvents, integration.userId, calendar.summary);

    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(events).values(rows.slice(i, i + 100)).onConflictDoNothing();
    }

    await db
      .update(integrations)
      .set({ lastSyncedAt: new Date(), status: 'connected' })
      .where(eq(integrations.id, integration.id));

    console.log(
      JSON.stringify({
        msg: 'sync_complete',
        integration_id: integration.id,
        provider: 'google_calendar',
        events: rows.length,
        duration_ms: Date.now() - startTime,
      }),
    );

    return rows.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'GOOGLE_TOKEN_INVALID') {
      await db.update(integrations).set({ status: 'error' }).where(eq(integrations.id, integration.id));
    }
    console.error(
      JSON.stringify({
        msg: 'sync_failed',
        integration_id: integration.id,
        provider: 'google_calendar',
        error: message,
        duration_ms: Date.now() - startTime,
      }),
    );
    throw err;
  }
}

export async function syncAllIntegrations(): Promise<void> {
  const activeIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.status, 'connected'));

  for (const integration of activeIntegrations) {
    try {
      await syncIntegration(integration.id);
    } catch {
      // Individual sync failure logged inside syncIntegration, continue to next
    }
  }
}
