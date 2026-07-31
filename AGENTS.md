# ScheduleRU contributor boundaries

## Safety

- Work from a task branch or isolated worktree, never directly on `main`.
- Preserve the production application while compatibility modules are being
  migrated.
- Production deployments and production D1 changes require explicit approval.
- Secrets belong in Cloudflare or local environment variables, never files.

## Ownership

- `apps/web`: presentation and browser integration.
- `apps/api`: HTTP routing and Cloudflare adapters.
- `packages/catalog`: program-definition contract and validation.
- `packages/planner`: deterministic four-year planning.
- `packages/requirements`: requirement progress and course allocation.
- `packages/scheduling`: semester scheduling and preferences.
- `tools/catalog`: catalog contributor commands.
- `migrations`: structural database changes only.

Catalog content must not be embedded in application code or structural
migrations. Cross-package behavior changes require contract tests.

## Verification

Run `npm test`, `npm run typecheck`, and `git diff --check` before handoff.
