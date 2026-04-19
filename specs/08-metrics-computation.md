# Spec 08: Metrics computation

## Context

With GitHub events flowing into the database (spec 07), we can compute the three v1 metrics. The architecture spec mandates that metrics live in `packages/metrics` as pure functions — they take event data as input and return computed values. No database access inside the metric functions. The API endpoints call the metrics package after querying the events.

## Goal

Implement the three v1 metrics as pure, versioned, tested functions in `packages/metrics`, and expose them via API endpoints in `apps/api`.

## Prerequisites

- Spec 07 is complete (events table has GitHub data)
- Spec 04 is complete (API structure exists)

## In scope

- `packages/metrics` — pure metric functions
- `apps/api` endpoints:
  - `GET /v1/metrics/overview` — all three metrics for a time window
  - `GET /v1/metrics/timeseries` — single metric as a time series
- Unit tests for every metric function
- Delta computation (current window vs previous window of same length)

## Out of scope

- Pre-computed/cached metrics (v1 computes on every request)
- Continuous aggregates or materialized views (phase 2)
- Metrics that require calendar data (focus hours v2)
- Metric versioning UI (v1 only has v1 definitions)

## Requirements

1. `packages/metrics/src/focus-hours.ts` exports `focusHoursV1(events, windowStart, windowEnd)`:
   - Groups commit events by day
   - Identifies "commit blocks" — sequences of commits within 2-hour windows
   - Returns the total number of hours spanned by these blocks
   - This is a proxy for focus time with GitHub data only; the real definition (with calendar data) comes in v2

2. `packages/metrics/src/cycle-time.ts` exports `cycleTimeDaysV1(events, windowStart, windowEnd)`:
   - Filters to `github.pr.merged` events within the window
   - For each PR, computes `merged_at - first_commit_authored_at` from the PR payload
   - Returns the median cycle time in days
   - Returns `null` if no PRs were merged in the window

3. `packages/metrics/src/throughput.ts` exports `throughputTasksV1(events, windowStart, windowEnd)`:
   - Counts `github.pr.merged` events within the window
   - Returns the count

4. Each metric function also returns a `delta` — the percentage change compared to the previous window of the same length. For example, if the window is 30 days, the delta compares to the 30 days before that.

5. `packages/metrics/src/index.ts` re-exports all metric functions.

6. Every metric function has unit tests in `packages/metrics/src/__tests__/` using Vitest with fixed input data and expected outputs.

7. `GET /v1/metrics/overview?window=30d` returns:
   ```json
   {
     "window": "30d",
     "metrics": {
       "focus_hours": { "value": 24.5, "delta": 0.12, "unit": "hours" },
       "cycle_time": { "value": 2.3, "delta": -0.08, "unit": "days" },
       "throughput": { "value": 12, "delta": 0.25, "unit": "prs" }
     }
   }
   ```

8. `GET /v1/metrics/timeseries?metric=focus_hours&window=30d&bucket=day` returns:
   ```json
   {
     "metric": "focus_hours",
     "window": "30d",
     "bucket": "day",
     "data": [
       { "date": "2026-03-20", "value": 3.5 },
       { "date": "2026-03-21", "value": 0 },
       ...
     ]
   }
   ```

9. Supported windows: `7d`, `30d`, `90d`. Supported buckets: `day`, `week`.

## File changes

### Created
- `packages/metrics/src/focus-hours.ts` — focus hours metric
- `packages/metrics/src/cycle-time.ts` — cycle time metric
- `packages/metrics/src/throughput.ts` — throughput metric
- `packages/metrics/src/types.ts` — shared types (MetricResult, TimeseriesPoint)
- `packages/metrics/src/__tests__/focus-hours.test.ts`
- `packages/metrics/src/__tests__/cycle-time.test.ts`
- `packages/metrics/src/__tests__/throughput.test.ts`
- `apps/api/app/v1/metrics/overview/route.ts`
- `apps/api/app/v1/metrics/timeseries/route.ts`

### Modified
- `packages/metrics/package.json` — add `vitest` dev dependency, `test` script
- `packages/metrics/src/index.ts` — replace placeholder with real exports
- `packages/api-client/openapi.yaml` — add metrics endpoint schemas
- `apps/api/package.json` — add `@baseline/metrics` workspace dependency

## Acceptance criteria

- `pnpm --filter @baseline/metrics test` passes all unit tests
- `GET /v1/metrics/overview?window=30d` returns all three metrics with values and deltas
- `GET /v1/metrics/timeseries?metric=focus_hours&window=30d&bucket=day` returns a data array with one entry per day
- Metrics return `0` or `null` gracefully when no events exist for the window
- `pnpm build` exits zero
- `pnpm type-check` exits zero

## Notes for Claude Code

- Metric functions are pure. They receive an array of event objects and date boundaries. They do NOT import `@baseline/db` or access the database. The API handler queries the database and passes the result to the metric function.
- Use Vitest for tests. Configure it in `packages/metrics/vitest.config.ts`.
- The delta is a ratio, not a percentage. `0.12` means +12%. `-0.08` means -8%. `null` if the previous window has no data.
- For `focusHoursV1`, a "commit block" is defined as: sort commits by `occurred_at`, walk through them, and group consecutive commits that are within 2 hours of each other. The block's duration is `last_commit_time - first_commit_time`. If a block has only one commit, count it as 0.5 hours (minimum focus unit).
- For `cycleTimeDaysV1`, the first commit on the branch must be available in the PR's payload. If it's not (because the payload doesn't include it), fall back to `created_at` as a proxy for when work started.
- The API handler for `/v1/metrics/overview` makes one database query (all events in the window + previous window), then calls each metric function with the appropriate subset. Do not make three separate queries.
