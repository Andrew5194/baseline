# Spec 05: Authentication

## Context

The API endpoints from spec 04 use a stubbed user ID. Before users can connect integrations or view their own data, we need real authentication. The architecture spec mandates Auth.js with email magic-link authentication. Single-tenant per deployment is acceptable for v1.

## Goal

Add Auth.js to `apps/api` and `apps/web` so users can sign up, sign in via magic link, and have their session propagate to API requests.

## Prerequisites

- Spec 03 is complete (users table exists)
- Spec 04 is complete (API endpoints exist with stubbed user)
- A Resend API key is available for sending magic-link emails

## In scope

- Auth.js (NextAuth v5) configuration in `apps/api`
- Email magic-link provider using Resend as the email transport
- Auth.js session tables in the database (managed by Auth.js Drizzle adapter)
- Session middleware in `apps/api` that extracts the authenticated user
- Replace all stubbed user IDs with the real session user
- Auth.js session provider in `apps/web` for client-side session access
- Sign-in page in `apps/web`
- Protected route wrapper — redirect unauthenticated users to sign-in

## Out of scope

- OAuth providers other than the magic link (GitHub OAuth is for integration, not login)
- API keys for external consumers (phase 2)
- Role-based access control (phase 2)
- Multi-tenant admin features (phase 2)

## Requirements

1. Auth.js is configured in `apps/api` with the Drizzle adapter, creating its session/account/verification tables via migration.

2. The email provider uses Resend to send magic-link emails. The sender address and API key come from environment variables (`RESEND_API_KEY`, `AUTH_EMAIL_FROM`).

3. Signing in creates a `users` row if one doesn't exist for that email (first-time signup).

4. Every API route in `apps/api` except `/v1/healthz` requires a valid session. Unauthenticated requests return `401 { error: "Unauthorized", code: "UNAUTHORIZED" }`.

5. `apps/web` has an Auth.js `SessionProvider` in the root layout. Pages check the session and redirect to `/sign-in` if not authenticated.

6. `apps/web/app/sign-in/page.tsx` renders a minimal email input form. Submitting sends a magic link. A success state tells the user to check their email.

7. The session cookie is `HttpOnly`, `Secure` (in production), `SameSite=Lax`.

8. The API extracts `user_id` from the session in every handler, replacing the spec 04 stub.

## File changes

### Created
- `apps/api/lib/auth.ts` — Auth.js configuration (providers, adapter, callbacks)
- `apps/api/app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- `apps/web/app/sign-in/page.tsx` — sign-in page with email form
- `apps/web/lib/auth.ts` — Auth.js client configuration for web app

### Modified
- `apps/api/package.json` — add `next-auth`, `@auth/drizzle-adapter`, Resend dependencies
- `apps/web/package.json` — add `next-auth`
- `packages/db/src/schema.ts` — add Auth.js tables (accounts, sessions, verification_tokens) or let the adapter manage them
- All API route handlers in `apps/api` — replace stubbed user with session user

## Acceptance criteria

- Visiting `http://localhost:3002` redirects to `/sign-in`
- Entering an email on `/sign-in` sends a magic-link email via Resend
- Clicking the magic link authenticates the user and redirects to the dashboard
- The user's email appears in the `users` table
- API requests without a session return 401
- API requests with a valid session return the user's data
- `pnpm build` exits zero

## Notes for Claude Code

- Use Auth.js v5 (the `next-auth@beta` package, now stable as v5).
- The Drizzle adapter is `@auth/drizzle-adapter`.
- Auth.js needs a `AUTH_SECRET` environment variable. Generate one with `openssl rand -base64 32`.
- For local development, magic links work with Resend in test mode (emails go to the Resend dashboard, not a real inbox). Alternatively, use the Auth.js `console` email provider for development that prints the link to the terminal.
- The sign-in page should be minimal and on-brand — neutral tones, Geist font, no decoration. Just an email input and a submit button.
- `AUTH_URL` should be set to the API server's URL (e.g., `http://localhost:3001`).
- Do not implement "sign out" as a dedicated page — a button in the web app's header that calls the Auth.js sign-out endpoint is sufficient.
