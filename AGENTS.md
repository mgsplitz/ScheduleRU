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

## Release standard

- Ship complete student journeys, not implementation-status disclaimers.
  Student-facing planning flows must never describe academic facts as
  "unverified," "under review," "not ready," or "coming later."
- Incomplete academic facts are a publication blocker. Keep the diagnostic in
  validation and contributor tooling; do not make students discover it at
  runtime.
- Course metadata, prerequisites, standing rules, equivalencies, exclusions,
  and provenance must come from the canonical academic-facts contracts. Do not
  duplicate or patch these facts in web or planner code.
- Optimize first for correctness and clarity. Performance copies or abridged
  planning stores require parity tests against the canonical source before use.

## Verification

- Start behavior changes with a failing regression test at the lowest useful
  layer, then add a cross-package contract test for every affected boundary.
- Unit tests alone are insufficient for student-visible work. Verify the real
  user journey—including rendered state, navigation, persistence, and error
  recovery—at desktop viewport size with production-shaped data.
- Critical planner tests must cover prerequisites, standing, completed credit,
  equivalencies, credit exclusions, multi-program overlap, and all eight
  semesters. A test that bypasses the API-to-planner adapter is not sufficient.
- Before handoff run `npm test`, `npm run typecheck`, and `git diff --check`,
  plus the relevant browser journey. Record what the student actually sees.
