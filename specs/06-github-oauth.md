# Spec 06: GitHub OAuth and integration connect/disconnect

## Context

With authentication in place (spec 05), users can sign in. The next step is letting them connect their GitHub account so Baseline can pull activity data. This spec covers the OAuth flow to obtain a GitHub access token and the UI to manage the connection. The actual data ingestion happens in spec 07.

## Goal

Allow an authenticated user to connect and disconnect their GitHub account via OAuth, storing the access token in the `integrations` table.

## Prerequisites

- Spec 05 is complete (authentication works, user exists in the database)
- The user has created a GitHub OAuth App (for self-hosting) or a Baseline GitHub App is available
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` environment variables are set

## In scope

- GitHub OAuth flow initiated from `apps/web`, handled by `apps/api`
- `apps/api` endpoints:
  - `GET /v1/integrations/github/authorize` — returns the GitHub OAuth authorization URL
  - `GET /v1/integrations/github/callback` — handles the OAuth callback, exchanges code for token, stores in `integrations`
- Token storage in the `integrations` table (plaintext in v1, encrypted in phase 2)
- `apps/web` Sources page showing connection status and connect/disconnect buttons
- Disconnecting revokes the token (if GitHub supports it) and sets integration status to `disconnected`
- `packages/integrations/github/src/oauth.ts` — GitHub OAuth helper functions

## Out of scope

- Data ingestion / pulling commits and PRs (spec 07)
- Other OAuth providers (Google Calendar, Slack — future)
- GitHub App installation flow (v1 uses a simple OAuth App)
- Token encryption (phase 2)
- Token refresh (GitHub personal access tokens don't expire; OAuth app tokens do — handle refresh in spec 07 if needed)

## Requirements

1. `packages/integrations/github/src/oauth.ts` exports functions:
   - `buildAuthorizationUrl(clientId, redirectUri, state)` — constructs the GitHub OAuth URL with scopes `read:user`, `repo`
   - `exchangeCodeForToken(clientId, clientSecret, code)` — exchanges authorization code for access token
   - `fetchGitHubUser(accessToken)` — fetches the authenticated user's profile (username, avatar)

2. `GET /v1/integrations/github/authorize` generates a random `state` parameter, stores it in the session or a short-lived cookie, and redirects to GitHub's authorization page.

3. `GET /v1/integrations/github/callback` validates the `state`, exchanges the code for a token, upserts the `integrations` row with `provider: 'github'`, and redirects back to the Sources page in `apps/web`.

4. The Sources page in `apps/web` at `/sources` shows:
   - A card for GitHub with status (connected/disconnected), the connected username, and last sync time
   - A "Connect" button that initiates the OAuth flow
   - A "Disconnect" button that calls `DELETE /v1/integrations/{id}`

5. Disconnecting sets the integration status to `disconnected` and clears the `access_token`.

6. If a user connects GitHub when they already have a disconnected GitHub integration, the existing row is updated (upsert on `user_id, provider` unique constraint) rather than creating a new row.

## File changes

### Created
- `packages/integrations/github/src/oauth.ts` — OAuth helper functions
- `apps/api/app/v1/integrations/github/authorize/route.ts` — initiate OAuth
- `apps/api/app/v1/integrations/github/callback/route.ts` — handle callback
- `apps/web/app/sources/page.tsx` — integration management page

### Modified
- `packages/integrations/github/package.json` — no new dependencies needed (uses native fetch)
- `packages/integrations/github/src/index.ts` — re-export OAuth functions
- `apps/api/package.json` — add `@baseline/integrations-github` workspace dependency
- `apps/web/package.json` — add `@baseline/api-client` workspace dependency

## Acceptance criteria

- Clicking "Connect" on the Sources page redirects to GitHub's OAuth consent screen
- After authorizing, the user is redirected back to `/sources` with GitHub showing as connected
- The `integrations` table contains a row with the GitHub access token and the user's GitHub username
- Clicking "Disconnect" clears the token and shows GitHub as disconnected
- Re-connecting after disconnecting updates the existing row (no duplicate rows)
- `pnpm build` exits zero

## Notes for Claude Code

- For self-hosting, users create their own GitHub OAuth App at https://github.com/settings/developers. The callback URL should be `{API_URL}/v1/integrations/github/callback`.
- Scopes needed: `read:user` (profile), `repo` (to read commits, PRs, reviews across all repos). If `repo` is too broad, start with `public_repo` and note the limitation.
- The `state` parameter for CSRF protection should be a random string stored in a cookie with `SameSite=Lax`, `HttpOnly`, and a short TTL (10 minutes).
- Do not use Auth.js's built-in GitHub provider for this — that's for login. This is a data integration, stored in the `integrations` table, not the Auth.js `accounts` table.
- The redirect after callback should go to `{WEB_URL}/sources` (the web app), not stay on the API server.
