# Spec 04: API contract and first endpoints

## Context

With the database layer in place (spec 03), we need an API contract that the web app can consume. The architecture spec mandates OpenAPI 3.1 as the source of truth, with types generated via `openapi-typescript` and requests made via `openapi-fetch`. This spec defines the contract and implements the first real endpoints beyond the healthcheck.

## Goal

Define the OpenAPI spec in `packages/api-client`, generate TypeScript types from it, and implement the v1 integration and event endpoints in `apps/api`.

## Prerequisites

- Spec 03 is complete (database tables exist and are migrated)
- PostgreSQL is running with the schema applied

## In scope

- OpenAPI 3.1 spec file in `packages/api-client`
- Type generation via `openapi-typescript`
- Typed fetch client via `openapi-fetch`
- `apps/api` endpoints:
  - `GET /v1/healthz` (already exists)
  - `GET /v1/integrations` — list user's integrations
  - `POST /v1/integrations` — initiate an integration connection
  - `DELETE /v1/integrations/{id}` — disconnect an integration
  - `POST /v1/integrations/{id}/sync` — trigger manual resync
  - `GET /v1/events` — list events with cursor pagination
- Request validation using Zod
- Error response format standardization

## Out of scope

- Metrics endpoints (spec 08)
- Authentication middleware (spec 05 — stub user ID for now)
- GitHub OAuth callback handling (spec 06)
- Actual ingestion logic (spec 07)

## Requirements

1. `packages/api-client/openapi.yaml` defines the OpenAPI 3.1 spec with all v1 endpoints, request/response schemas, and error formats.

2. Running `pnpm --filter @baseline/api-client generate` produces `packages/api-client/types.d.ts` from the OpenAPI spec.

3. `packages/api-client/src/index.ts` exports a pre-configured `openapi-fetch` client and the generated types.

4. `apps/api` implements each endpoint as a Next.js route handler that:
   - Validates request input
   - Queries the database via `@baseline/db`
   - Returns responses matching the OpenAPI schema
   - Uses a consistent error format: `{ error: string, code: string }`

5. All endpoints are scoped to a single user. For now, use a hardcoded user ID or a `X-User-Id` header until auth is implemented in spec 05.

6. `GET /v1/events` supports cursor-based pagination via `cursor` and `limit` query parameters, ordered by `occurred_at` descending.

7. `DELETE /v1/integrations/{id}` sets `status` to `disconnected` rather than deleting the row.

## File changes

### Created
- `packages/api-client/openapi.yaml` — OpenAPI 3.1 specification
- `packages/api-client/types.d.ts` — generated types (via codegen, not hand-written)
- `apps/api/app/v1/integrations/route.ts` — GET and POST handlers
- `apps/api/app/v1/integrations/[id]/route.ts` — DELETE handler
- `apps/api/app/v1/integrations/[id]/sync/route.ts` — POST handler
- `apps/api/app/v1/events/route.ts` — GET handler

### Modified
- `packages/api-client/package.json` — add `openapi-typescript`, `openapi-fetch` dependencies and `generate` script
- `packages/api-client/src/index.ts` — replace placeholder with real client export
- `apps/api/package.json` — add `@baseline/db`, `@baseline/api-client` as workspace dependencies

## Acceptance criteria

- `pnpm --filter @baseline/api-client generate` produces `types.d.ts` without errors
- `pnpm build` exits zero across the entire repo
- `GET /v1/integrations` returns `[]` for a user with no integrations
- `POST /v1/integrations` with `{ "provider": "github" }` creates a row and returns it
- `DELETE /v1/integrations/{id}` marks the integration as disconnected
- `GET /v1/events` returns paginated results with `next_cursor` when more rows exist
- All responses match the shapes defined in `openapi.yaml`
- Importing the typed client in `apps/web` compiles and provides autocomplete

## Notes for Claude Code

- Use `openapi-typescript` v7+ which supports OpenAPI 3.1.
- The `generate` script should be: `openapi-typescript openapi.yaml -o types.d.ts`.
- Use `openapi-fetch` for the client — it provides type-safe `GET`, `POST`, `DELETE` methods derived from the spec.
- For cursor pagination, use the event's `occurred_at` + `id` as the cursor (encoded as a base64 string). Never use offset-based pagination.
- The user-scoping stub (hardcoded user or header) must be clearly marked with a `// TODO: replace with auth (spec 05)` comment so it's easy to find and replace.
- Do not add authentication middleware in this spec. That's spec 05.
