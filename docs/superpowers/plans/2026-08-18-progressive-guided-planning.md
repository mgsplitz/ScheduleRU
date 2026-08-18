# Progressive Guided Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce complete, overlap-aware guided course recommendations without repeated ratings or overwhelming course lists.

**Architecture:** Merge every reviewed candidate source before optimization, keep preference state globally by course code, and use a pure presentation model for deterministic shortlists. Resolve prerequisite metadata through one API boundary and make recommendation approval transition directly into plan generation.

**Tech Stack:** Browser JavaScript modules, Cloudflare Workers and D1, Node test runner.

## Global Constraints

- Do not embed program course lists or titles in application code or structural migrations.
- Preserve reviewed double-count and prerequisite rules.
- Keep all browser state local.
- Production and `main` remain untouched.
- Run `npm test`, `npm run typecheck`, and `git diff --check` before handoff.

---

### Task 1: Merge Explicit and Selector Candidates

**Files:**
- Modify: `apps/web/src/planning-decision-loader.js`
- Test: `worker/tests/planning-decision-loader.test.mjs`

**Interfaces:**
- Consumes: `hydrate({ decisions, request, normalizeCandidate })`
- Produces: each decision with `candidates` equal to the code-keyed merge of explicit records and every selector page.

- [ ] Add a test whose four-slot Math decision has two explicit courses and a selector response containing 28 additional courses; assert all 30 unique candidates remain.
- [ ] Run `node --test worker/tests/planning-decision-loader.test.mjs` and confirm the candidate-count assertion fails with `2 !== 30`.
- [ ] Change hydration to fetch selectors even when explicit candidates exist, normalize both sources, and merge richer nonblank fields by course code.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Add Canonical Batch Metadata Lookup

**Files:**
- Create: `migrations/schema_course_reference.sql`
- Modify: `apps/api/src/worker.js`
- Modify: `packages/catalog/src/publisher.ts`
- Modify: `apps/web/src/planning-decision-loader.js`
- Test: `worker/tests/catalog-selector-api.test.mjs`
- Test: `worker/tests/planning-decision-loader.test.mjs`
- Test: `packages/catalog/test/publisher.test.ts`

**Interfaces:**
- Produces: `course_reference(course_code, title, credits, source_kind, source_url, updated_at)` and `GET /api/course-metadata?codes=01:730:407,01:730:408` returning `{ courses: [{ code, title, credits }] }`.
- Loader enriches candidate and prerequisite-only records through `courseMetadataByCode`.

- [ ] Add publisher and API tests proving canonical metadata is populated generically from titled catalog definitions and returned for courses absent from the active term.
- [ ] Add a loader test proving prerequisite codes are batch-requested and stored with titles.
- [ ] Run both tests and confirm the endpoint and metadata assertions fail.
- [ ] Add the structural table, upsert it from normal course sync and reviewed catalog publication, and implement validated bounded batch lookup.
- [ ] Extend loader output with `courseMetadataByCode` and re-run both focused tests.

### Task 3: Global Preferences and Overlap-Aware Ordering

**Files:**
- Modify: `apps/web/src/generation-decisions-controller.js`
- Test: `worker/tests/generation-decisions-controller.test.mjs`

**Interfaces:**
- Produces: `visibleCandidates(decisionId)`, `consideredCoverage(decisionId)`, and a global `coursePreferences` ledger returned by `preferences()`.

- [ ] Add tests showing one rating applies to two overlapping decisions, disappears from the second candidate list, and remains available in both optimizer preferences.
- [ ] Add a test showing a subset candidate pool precedes its containing broad pool.
- [ ] Run the focused test and confirm the new interface assertions fail.
- [ ] Implement canonical global ratings, dynamic visibility, coverage summaries, and deterministic constrained-first ordering.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Deterministic Large-Pool Shortlists

**Files:**
- Create: `apps/web/src/guidance-shortlist-model.js`
- Modify: `apps/web/src/generation-decisions-view.js`
- Modify: `index.html`
- Test: `worker/tests/guidance-shortlist-model.test.mjs`
- Test: `worker/tests/generation-decisions-view.test.mjs`

**Interfaces:**
- Produces: `shortlist({ candidates, coverageByCode, limit: 8 })` and view state supporting `expanded` and `query`.

- [ ] Add tests asserting an eight-course limit, multi-coverage priority, stable ordering, and full-pool expansion.
- [ ] Run focused tests and confirm the missing model and expansion assertions fail.
- [ ] Implement the pure shortlist model and render “Show all N options,” search, and the already-considered summary.
- [ ] Re-run focused tests and confirm they pass.

### Task 5: Direct Recommendation Approval

**Files:**
- Modify: `apps/web/src/guided-setup-controller.js`
- Test: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Produces: `proceedWithApprovedCourses(input)` that generates immediately when Core is complete and delegates only incomplete Core to the warning modal.

- [ ] Add integration assertions that “Use these courses” invokes the direct transition and the completed-Core path does not display a second generic confirmation.
- [ ] Run the focused integration test and confirm it fails against the current callback.
- [ ] Extract the transition function and wire recommendation approval to it.
- [ ] Re-run the focused test and confirm it passes.

### Task 6: End-to-End Verification and Development Publication

**Files:**
- Modify: generic catalog/reference-data tooling only if the current reviewed snapshot lacks a canonical title needed by a prerequisite.
- Test: relevant `worker/tests/*` contract files.

**Interfaces:**
- Development API and `dev` branch only.

- [ ] Backfill canonical metadata from existing catalog rows and reviewed definitions through the generic publisher; do not add program IDs or course-code maps to application logic.
- [ ] Apply the structural migration and publish the generic metadata path to development D1.
- [ ] Run `npm test`, `npm run typecheck`, and `git diff --check`.
- [ ] Browser-test Finance with CS, Mathematics, and Philosophy minors through recommendation approval and an eight-semester preview.
- [ ] Commit focused checkpoints, fast-forward `dev`, and push `dev`.
