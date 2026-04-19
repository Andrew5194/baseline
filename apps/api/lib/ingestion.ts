import { db, integrations, events } from '@baseline/db';
import { eq } from 'drizzle-orm';
import {
  fetchUserCommits,
  fetchUserPullRequests,
  fetchUserReviews,
  normalizeCommits,
  normalizePullRequests,
  normalizeReviews,
} from '@baseline/integrations-github';

export async function syncIntegration(integrationId: string): Promise<number> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId));

  if (!integration || integration.status !== 'connected' || !integration.accessToken) {
    throw new Error('Integration not connected or missing token');
  }

  const username = integration.externalAccountId;
  if (!username) {
    throw new Error('No GitHub username on integration');
  }

  const since = integration.lastSyncedAt || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
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
