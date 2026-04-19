# Spec 07: GitHub ingestion worker

## Context

With GitHub OAuth connected (spec 06), we have an access token but no data. This spec builds the ingestion pipeline that pulls commits, pull requests, and reviews from GitHub, normalizes them into the `events` table, and runs on a schedule. The write path must be idempotent — re-running ingestion must not create duplicate events.

## Goal

Build a scheduled ingestion worker in `apps/api` that pulls GitHub activity for all connected integrations and writes normalized events to the database.

## Prerequisites

- Spec 06 is complete (GitHub OAuth works, access token is stored in `integrations`)
- Spec 03 is complete (events table exists with the unique constraint on `source, source_id, event_type`)

## In scope

- `packages/integrations/github/src/client.ts` — GitHub API client (REST + GraphQL)
- `packages/integrations/github/src/normalizer.ts` — maps GitHub API responses to `events` rows
- `packages/events/src/types.ts` — canonical event type definitions and Zod schemas
- Ingestion logic that:
  - Fetches commits from all repos the user has pushed to
  - Fetches merged pull requests authored by the user
  - Fetches PR reviews authored by the user
  - Uses `integrations.last_synced_at` as the since-date for incremental pulls
  - Writes events with `ON CONFLICT DO NOTHING` for idempotency
  - Updates `integrations.last_synced_at` after successful sync
- Scheduled execution via `node-cron` inside `apps/api`
- Manual trigger via `POST /v1/integrations/{id}/sync` (endpoint from spec 04, logic added here)
- Error handling: if a sync fails, set `integrations.status` to `error` and log the reason

## Out of scope

- Google Calendar ingestion (future)
- Webhook-based ingestion (future — this spec uses polling)
- Historical backfill beyond 90 days (v1 pulls the last 90 days on first sync, then incremental)
- Rate-limit handling beyond basic backoff (GitHub gives 5,000 req/hr with a token)

## Requirements

1. `packages/events/src/types.ts` defines the canonical event types for GitHub:
   - `github.commit.pushed` — a commit authored by the user
   - `github.pr.merged` — a pull request authored by the user that was merged
   - `github.pr.reviewed` — a PR review submitted by the user
   
   Each type has a Zod schema for its `payload` shape.

2. `packages/integrations/github/src/client.ts` exports functions:
   - `fetchUserCommits(token, username, since)` — returns commits across repos
   - `fetchUserPullRequests(token, username, since)` — returns merged PRs
   - `fetchUserReviews(token, username, since)` — returns PR reviews
   
   All functions handle pagination (GitHub returns max 100 items per page).

3. `packages/integrations/github/src/normalizer.ts` exports a function:
   - `normalizeGitHubEvents(rawData, userId)` — maps raw API responses to `events` table rows with the correct `source`, `source_id`, `event_type`, `occurred_at`, and `payload`.

4. The ingestion worker runs every 15 minutes via `node-cron` when the API server starts.

5. For each active GitHub integration (`status = 'connected'`):
   - Pull activity since `last_synced_at` (or 90 days ago if null — first sync)
   - Normalize and insert events with `ON CONFLICT (source, source_id, event_type) DO NOTHING`
   - Update `last_synced_at` to the current time
   - If an error occurs, set `status = 'error'` and continue to the next integration

6. `POST /v1/integrations/{id}/sync` triggers an immediate sync for a single integration (the endpoint shell exists from spec 04; this spec adds the implementation).

7. Ingestion logs structured JSON via `console.log` (pino is phase 2) with the integration ID, event count, and duration.

## File changes

### Created
- `packages/events/src/types.ts` — event type definitions and Zod schemas
- `packages/integrations/github/src/client.ts` — GitHub API client
- `packages/integrations/github/src/normalizer.ts` — raw → events normalizer
- `apps/api/lib/ingestion.ts` — orchestration logic (for-each integration, pull, normalize, insert)
- `apps/api/lib/cron.ts` — node-cron schedule setup

### Modified
- `packages/events/package.json` — add `zod` dependency
- `packages/events/src/index.ts` — re-export types
- `packages/integrations/github/package.json` — add dependencies if needed
- `packages/integrations/github/src/index.ts` — re-export client and normalizer
- `apps/api/app/v1/integrations/[id]/sync/route.ts` — wire up ingestion logic
- `apps/api/package.json` — add `node-cron`, `@baseline/events`, `@baseline/integrations-github`

## Acceptance criteria

- Connecting a GitHub account and triggering a manual sync populates the `events` table with commits, PRs, and reviews from the last 90 days
- Running the same sync again does not create duplicate events (idempotency verified by checking row count)
- The cron job runs automatically every 15 minutes after API server startup
- `GET /v1/events` returns the ingested events in reverse chronological order
- An integration with an expired or revoked token gets its status set to `error`
- `pnpm build` exits zero
- `pnpm --filter @baseline/events type-check` exits zero

## Notes for Claude Code

- For commits, use the GitHub REST API: `GET /users/{username}/events` filtered to `PushEvent`, or the GraphQL `contributionsCollection` query. The REST events API is simpler but only goes back 90 days, which is fine for v1.
- For PRs, use `GET /search/issues?q=author:{username}+type:pr+is:merged+merged:>{since}`.
- For reviews, use `GET /search/issues?q=reviewed-by:{username}+type:pr+updated:>{since}` then fetch individual review data.
- The `source_id` for commits should be the commit SHA. For PRs, use `{owner}/{repo}#{number}`. For reviews, use `{owner}/{repo}#{number}/review/{review_id}`.
- `ON CONFLICT DO NOTHING` is the key idempotency mechanism. Do not use `ON CONFLICT DO UPDATE` — events are immutable once written.
- Use `node-cron` (not `cron` or `croner`). The schedule expression for every 15 minutes is `*/15 * * * *`.
- If the GitHub API returns a 401, the token is invalid. Set the integration status to `error`.
