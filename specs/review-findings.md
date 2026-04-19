# Review Findings — Specs 03-09 Implementation

Captured 2026-04-19 after code review and architectural review.

## Critical Bugs (Fixed)

1. **POST /v1/integrations** — fallback query filtered by userId only, not provider
2. **Missing cascade deletes** — integrations and events tables lacked onDelete cascade
3. **Unvalidated inputs** — date params and JSON body not validated

## Architectural Concerns (To Address)

| Issue | Severity | Effort |
|---|---|---|
| Cron runs in Next.js process — won't work on serverless | Blocking | 4-6h |
| Env var naming inconsistent (API_URL vs NEXT_PUBLIC_API_URL) | Blocking | 1h |
| Tokens stored plaintext | High (spec says phase 2) | 8-12h |
| Web app uses custom apiFetch not generated openapi-fetch client | Medium | 2h |
| No unit tests for metrics | Medium | 3-4h |
| CSRF token empty in sign-in form | Medium | 1h |
| No error boundaries in dashboard UI | Medium | 2h |
| .env.example outdated — missing new vars | Medium | 1h |
| Promise.all in sync — one failure blocks all data | Medium | 30m |
| No rate limiting on API | Medium | 3-4h |
| No logging infrastructure (pino, Sentry) | Medium | 2-4h |
| No retention policy on events table | Low | 4-6h |
| Auth session may not work cross-origin in production | High | 4-6h |

## Production Readiness Estimate

~40-60 hours to address all items. Top priorities:
1. Externalize cron scheduler
2. Standardize env vars and update .env.example
3. Token encryption (phase 2)
4. Add unit tests for metrics
5. Error boundaries in dashboard UI
