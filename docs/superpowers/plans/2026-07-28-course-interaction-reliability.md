# Course Interaction Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix the shared course-selection, rerender-state, manual-placement, builder-display, and assistant-configuration bugs demonstrated in `prompt-2.pdf`.

**Architecture:** Add a small pure course-interaction module for canonical identity, record merging, selection decisions, placement warnings, section ordering, and calendar geometry. Keep DOM integration in `index.html`, but make it consume these tested decisions so equivalent interactions follow one path.

**Tech Stack:** Browser JavaScript, Cloudflare Worker, D1, Node test runner, existing modal and planner modules.

## Global Constraints

- Rutgers course code is the canonical course identity.
- Unknown official credits or prerequisites are never invented.
- Automatic plan generation remains strict and never consumes manual overrides.
- Manual overrides require explicit confirmation and remain visible.
- Selector-backed requirements use the existing reviewed selector API.
- Open/scroll/focus state survives ordinary rerenders.
- No live OpenAI calls in automated tests; at most one minimal live diagnosis call.
- No subagents or parallel implementation.
- Push only to `codex/systemic-planner-fixes` and `dev`; leave `main` untouched.

---

### Task 1: Canonical course records and cross-program selection

**Files:**
- Create: `course-interaction-logic.js`
- Modify: `index.html`
- Create: `worker/tests/course-interaction-logic.test.mjs`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Produces `ScheduleRUCourseInteractionLogic.mergeCourseRecords(records)`.
- Produces `ScheduleRUCourseInteractionLogic.courseNumber(code)`.
- Produces `ScheduleRUCourseInteractionLogic.selectedCourseCodes(groupSelections, resolveCourse)`.
- Produces `ScheduleRUCourseInteractionLogic.requirementSelectionAction(input)`.

- [x] Write failing tests proving that known credits/prerequisites survive record merging, `01:198:425` parses as level 425, selected codes deduplicate across groups, and the first eligible wishlist action fills an open requirement slot.
- [x] Run the focused tests and verify they fail because the module or behavior is absent.
- [x] Implement the pure helpers and load the new module before `index.html` application code.
- [x] Replace per-view record overwrites with canonical merges and include globally selected course records in compatible selector progress.
- [x] Run focused logic and integration tests until green.

### Task 2: Unified requirement modal and stable UI state

**Files:**
- Modify: `index.html`
- Modify: `planner-ui-logic.js`
- Modify: `worker/tests/planner-ui-logic.test.mjs`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Selector-backed groups call `openRequirementPicker(groupId)`.
- Modal selector state stores loading, error, records, search, page, and total.
- Required-root and nested-group open state is keyed by program and group.

- [x] Write failing tests for selector-backed placeholder/modal routing, persistent expansion, and catalog rerenders that do not unconditionally focus the search field.
- [x] Run the focused tests and verify the expected failures.
- [x] Fetch reviewed selector results inside the requirement modal with retry and pagination.
- [x] Preserve required-root, nested-group, catalog expansion, scroll, and focus across ordinary rerenders; reset shared-root defaults only on required-program tab changes.
- [x] Run focused tests and browser-reproduce wishlist selection, no scroll jump, and non-collapsing Business Core.

### Task 3: Explicit manual placement overrides

**Files:**
- Modify: `course-interaction-logic.js`
- Modify: `index.html`
- Modify: `worker/tests/course-interaction-logic.test.mjs`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Produces `manualPlacementWarnings({ currentCredits, incomingCredits, prerequisiteBlocked, standingBlocked })`.
- Confirmed entries store `manualOverrides: [{ kind, reason }]`.

- [x] Write failing tests for an 18-credit overflow warning, prerequisite/standing warning, combined warnings, and no warning at exactly 18 credits.
- [x] Run the focused tests and verify failures.
- [x] Make drag-and-drop show **Go back** plus the appropriate override action before mutating state.
- [x] Persist override reasons, show an Override badge, and revalidate when moving a course.
- [x] Verify auto-generation inputs do not read manual override permission.

### Task 4: Builder ordering and calendar geometry

**Files:**
- Modify: `course-interaction-logic.js`
- Modify: `index.html`
- Modify: `worker/tests/course-interaction-logic.test.mjs`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Produces `sortSections(sections)`.
- Produces `calendarBlockGeometry({ startMinute, endMinute, dayStartMinute, pixelsPerMinute })`.

- [x] Write failing tests for numeric section/index ordering and exact minute-based block offsets.
- [x] Run the focused tests and verify failures.
- [x] Sort copied section arrays before rendering and use absolute minute geometry on a taller weekday calendar.
- [x] Browser-check that a thirty-minute gap is visibly distinct and labels remain readable.

### Task 5: Schedule-assistant boundary diagnosis

**Files:**
- Modify only if evidence requires it: `index.html`, `worker/src/schedule-assistant.js`, `worker/src/worker.js`, `worker/wrangler.toml`
- Test: `worker/tests/schedule-assistant.test.mjs`
- Test: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Browser posts only to the configured backend `/api/schedule-assistant/interpret`.
- Worker reads `OPENAI_API_KEY` only from the active Worker environment.

- [x] Verify the development endpoint and route without sending an OpenAI request.
- [x] Verify the secret binding exists without reading or logging its value.
- [x] Add a failing regression only if the route/error mapping is incorrect.
- [x] Implement the smallest evidence-backed configuration or code fix.
- [x] Send at most one minimal live request after all local boundaries pass.

### Task 6: Full verification and development delivery

**Files:**
- Verify every modified source, test, and documentation file.

- [x] Run all focused tests.
- [x] Run `node --test worker/tests/*.test.mjs`.
- [x] Run `git diff --check` and inspect the complete diff.
- [x] Reproduce the PDF workflows in the browser.
- [x] Commit the implementation and atomically push the feature branch and `dev`; leave `main` untouched.
