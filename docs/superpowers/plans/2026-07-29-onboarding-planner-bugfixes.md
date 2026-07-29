# Onboarding and Planner Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the reported College Writing prerequisite, completed-course lookup, program-selection state, Core placeholder navigation, and four-year planner regressions at their shared system boundaries.

**Architecture:** Keep reviewed academic policy in D1-backed eligibility data, move onboarding course lookup onto the catalog API, centralize program picker rendering around draft state, and route Core placeholders through the Courses catalog with their requirement context. Extend existing pure-logic and integration suites so each reported failure is reproducible without spending API credits.

**Tech Stack:** Cloudflare Worker/D1 SQL, browser JavaScript in `index.html`, Node.js built-in test runner.

## Global Constraints

- Work sequentially without agents.
- Do not modify the dirty primary workspace.
- Do not add course-specific frontend exceptions.
- Do not implement the deferred tour, overlap optimizer, catalog-tag expansion, or architecture migration.
- Do not call paid AI APIs in tests.

---

### Task 1: Reviewed College Writing eligibility

**Files:**
- Create: `worker/schema/reviewed_college_writing_eligibility.sql`
- Modify: `worker/tests/reviewed-course-prerequisites.test.mjs`
- Modify: `worker/tests/planner-input-logic.test.mjs`

**Interfaces:**
- Consumes: `course_eligibility_reviews` and `/api/course-eligibility`.
- Produces: a reviewed `no_known_conditions` record for `01:355:101`.

- [x] Add a failing regression asserting the reviewed seed marks `01:355:101` as having no enforced conditions.
- [x] Run the focused test and confirm it fails because the reviewed record is absent.
- [x] Add the reviewed SQL record with source metadata and an explanatory review note.
- [x] Prevent reviewed no-condition records from falling back to raw catalog prerequisite prose.
- [x] Run the focused eligibility and planner-input tests and confirm they pass.

### Task 2: Catalog-backed completed-course lookup

**Files:**
- Modify: `course-interaction-logic.js`
- Modify: `worker/tests/course-interaction-logic.test.mjs`
- Modify: `index.html`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Consumes: `/api/courses?search=...`.
- Produces: `rankOnboardingCourseMatches(courses, query)` and a debounced onboarding search UI that only adds verified catalog records.

- [x] Add failing tests for exact off-page code `33:011:100`, partial titles, abbreviations, common misspellings, and rejection of unverified text.
- [x] Run the focused tests and confirm the new behavior is absent.
- [x] Implement bounded normalization and ranking in the existing shared course-interaction helper.
- [x] Wire onboarding search and exact-code Add fallback to the catalog API.
- [x] Run the focused logic and UI-integration tests.

### Task 3: Program picker state and sticky apply action

**Files:**
- Create: `program-picker-logic.js`
- Create: `worker/tests/program-picker-logic.test.mjs`
- Modify: `index.html`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Consumes: `ST.programDraft`, school context, and committed `ST.selectedPrograms`.
- Produces: deterministic picker view state and onboarding-safe initial program selection.

- [x] Add failing tests proving new onboarding begins without BAIT, role controls derive from the latest draft, and committed programs refresh the onboarding summary.
- [x] Run the focused tests and confirm expected failures.
- [x] Implement the pure draft-to-view helper and integrate rerendering after every draft mutation.
- [x] Preserve the legacy default only outside incomplete onboarding and add a sticky Apply Programs footer.
- [x] Run focused state and UI-integration tests.

### Task 4: Core placeholder catalog navigation

**Files:**
- Modify: `worker/src/planner-ui-logic.js`
- Modify: `worker/src/planner-input-logic.js`
- Modify: `worker/tests/planner-ui-logic.test.mjs`
- Modify: `worker/tests/planner-input-logic.test.mjs`
- Modify: `worker/src/worker.js`
- Modify: `worker/tests/catalog-selector-api.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: placeholder `candidateSelectionContext` including source, group, selectors, and course codes.
- Produces: a Courses-page destination for Core placeholders and a visible active requirement filter.

- [x] Add failing tests asserting all Core placeholders retain full candidate context and route to the Courses page.
- [x] Run the focused tests and confirm they fail on the current incomplete/no-op path.
- [x] Preserve Core source metadata in every placeholder path and add deterministic destination logic.
- [x] Integrate navigation, selector/code filtering, and a clearable “Choosing for …” catalog banner.
- [x] Keep large reviewed selector pools under D1's bind-variable limit with JSON-array binds.
- [x] Run focused planner UI/input, catalog API, and integration tests.

### Task 5: Four-year regression and full verification

**Files:**
- Modify: `worker/tests/planner-correctness-regression.test.mjs`
- Modify: `worker/tests/four-year-planner-logic.test.mjs`

**Interfaces:**
- Consumes: reviewed requirements, reviewed eligibility, and deterministic planner fixtures.
- Produces: end-to-end regression coverage for false College Writing sequencing plus the repository's existing reviewed-program and planner matrix.

- [x] Add a failing adapter regression asserting College Writing does not inject Basic Composition or Academic Writing into the plan.
- [x] Add an end-to-end generation regression that preserves real downstream sequencing.
- [x] Run the focused planner suites and confirm the adapter regression fails before the logic fix.
- [x] Run the complete 329-test repository suite.
- [x] Run the Worker dry run, dev D1 update, and live dev API smoke checks.
- [x] Smoke-test onboarding course search and program-picker state in a local browser.
- [x] Review the diff against every immediate PDF requirement and verify no deferred feature entered scope.
