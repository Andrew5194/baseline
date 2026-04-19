# Specs

Specifications for building Baseline. Every meaningful piece of work has a spec before code is written.

## Roadmap

Execute in order. Later specs assume earlier ones are complete.

| # | Spec | Status |
|---|---|---|
| 00 | Product requirements | Reference document |
| 01 | System architecture | Reference document |
| 02 | Monorepo restructure | Complete |
| 03 | [Database layer](03-database-layer.md) | Ready to execute |
| 04 | [API contract + first endpoints](04-api-contract.md) | Ready to execute |
| 05 | [Authentication](05-authentication.md) | Ready to execute |
| 06 | [GitHub OAuth + connect/disconnect](06-github-oauth.md) | Ready to execute |
| 07 | [GitHub ingestion worker](07-github-ingestion.md) | Ready to execute |
| 08 | [Metrics computation](08-metrics-computation.md) | Ready to execute |
| 09 | [Dashboard](09-dashboard.md) | Ready to execute |

## How to use

1. Pick the next spec from the roadmap above.
2. Read it top to bottom before handing it to Claude Code.
3. Start a fresh Claude Code session and point it at the spec.
4. Let it work to the spec boundary — each spec has explicit scope and acceptance criteria.
5. Review the diff against the acceptance criteria.
6. If the checks pass, commit. If not, patch and re-check.

See [TEMPLATE.md](TEMPLATE.md) for the spec format.
