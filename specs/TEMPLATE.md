# Spec NN: [Short title]

## Context

Two or three sentences explaining why this work exists and what recently changed or was learned that motivated it. If this spec unblocks another one, say so.

## Goal

A single sentence describing the outcome. If you can't express the outcome in one sentence, the spec is doing too much — split it.

## Prerequisites

- Spec N is complete (link)
- Thing X exists in the codebase
- Tool Y is installed / available

## In scope

Bulleted, specific. Name files and behaviors.

- …
- …

## Out of scope

Explicit list of things this spec does NOT cover, to prevent drift. If there's an obvious next step, name it and say "handled in spec N+1."

- …
- …

## Requirements

Numbered, testable. Each requirement should have a clear "done" condition.

1. …
2. …
3. …

## File changes

### Created
- `path/to/file` — purpose

### Modified
- `path/to/file` — what changes and why

### Deleted
- `path/to/file` — why

### Moved
- `from/path` → `to/path` — preserve git history with `git mv`

## Acceptance criteria

Conditions that tell us it's done. Phrased as observable outcomes, not activities.

- `pnpm build` exits zero
- Visiting `http://localhost:3000` shows …
- Running `pnpm test packages/db` passes
- An attempt to `import { x } from '@baseline/db'` from `apps/marketing` fails with an ESLint error

## Notes for Claude Code

- Preferences about libraries, naming, structure that aren't covered above
- Known pitfalls or gotchas
- Questions to raise before proceeding (prefix the response with `QUESTION:`)
- Anything to deliberately NOT do
