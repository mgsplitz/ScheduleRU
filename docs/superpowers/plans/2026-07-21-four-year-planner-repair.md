# Four-Year Planner Repair Implementation Plan

> **Execution:** Run inline and sequentially in this task. The user explicitly prohibited subagents and parallel agent work.

**Goal:** Produce an eight-term Fall/Spring plan that visibly schedules every concrete required course it can support, preserves unresolved choices as typed placeholders, applies the accepted preview to the semester view, and never silently ignores prerequisites, standing, AP/substitutions, missing credits, or user pins.

**Architecture:** Add a pure browser-safe adapter that converts requirement trees and student state into a canonical planner contract. Extend the deterministic engine to enforce the supplied facts and to keep uncertain data visible as assumptions rather than dropping most courses. Keep accepted-plan merging in the state module so preview rendering and semester rendering consume the same result.

**Tech Stack:** Vanilla browser JavaScript, Node `node:test`, existing requirement/eligibility modules, local browser state.

## Global Constraints

- No agents or parallel execution.
- Fall/Spring only, exactly eight consecutive terms beginning at first-year Fall for new users.
- Do not require complete reviewed eligibility coverage before showing courses; current reviewed coverage is only 2 of 235 rows in the reported Econ + CS + Math case.
- Missing credits never become zero. Use a visible three-credit planning estimate and emit an issue.
- Hard maximum: 18 credits and 6 course-like entries per term.
- Generated courses are unlocked. Only explicit user pins survive regeneration.
- AP awards and approved alternatives use the same satisfaction mapping as Required.
- Unresolved `choose one`, elective, Core, and incomplete metadata remain typed placeholders or explicit issues, never fabricated course choices.
- `main` and production remain untouched.

---

### Task 1: Canonical requirement-to-planner adapter

**Files:**
- Create: `planner-input-logic.js`
- Create: `worker/tests/planner-input-logic.test.mjs`
- Modify: `index.html`

**Interface:**

`ScheduleRUPlannerInput.buildPlannerInput({ terms, requirementTrees, coreTree, groupSelections, schedule, wishlistCourses, completedCourseCodes, confirmedCredits })` returns `{ terms, courses, completedCourseCodes, lockedPlacements, prerequisitePathsByCode, unresolvedRequirements, confirmedCredits, issues }`.

- [ ] Write a failing realistic-tree test proving fixed `all` courses become planner courses while unselected `min_courses` and `one_of` requirements become typed placeholders.
- [ ] Write a failing AP/alternative test proving an approved completed alternative removes the canonical requirement course.
- [ ] Write a failing metadata test proving missing credits become `estimatedCredits: 3`, not zero, while title/code remain visible.
- [ ] Write a failing eligibility test proving reviewed paths, safely parsed catalog paths, minimum year, prior credits, and co-requisites survive the adapter.
- [ ] Run the new test and verify each assertion fails for the missing adapter.
- [ ] Implement the minimal pure adapter and expose it on `globalThis`.
- [ ] Load the module from `index.html` and replace the lossy `normalizedPlannerInputs()` construction with the adapter.
- [ ] Run the adapter, eligibility, requirement-group, and UI integration tests.

### Task 2: Eight-term deterministic generation

**Files:**
- Modify: `four-year-planner-logic.js`
- Modify: `worker/tests/four-year-planner-logic.test.mjs`
- Create: `worker/tests/planner-correctness-regression.test.mjs`

**Interface changes:**

Planner courses retain `{ code, title, credits, creditsEstimated, optional, eligibilityConditions, ruleCoverage }`. The result retains course metadata and returns `{ schedule, placeholders, issues, assumptions, termCredits, termCourseCounts }`.

- [ ] Add a failing test that fifteen missing-credit courses cannot enter one Fall term and no course has zero planning credits.
- [ ] Add a failing test that minimum-plan-year and prior-credit gates block early placement.
- [ ] Add a failing test for reviewed/canonical alternative prerequisite paths and correct physics sequence ordering.
- [ ] Add a failing test that optional wishlist courses fill capacity only after required work.
- [ ] Add a failing eight-term scenario proving concrete courses are distributed across the available horizon rather than front-loaded into one semester.
- [ ] Verify all new tests fail for the intended reasons.
- [ ] Preserve canonical metadata during normalization and result creation.
- [ ] Track course counts and enforce 18-credit/6-entry hard caps.
- [ ] Enforce minimum year, prior credits, prerequisite paths, and co-requisites before selecting a term.
- [ ] Select the least-loaded legal term, with prerequisite deadlines and deterministic tie-breaking.
- [ ] Keep unknown eligibility visible as assumptions/issues without deleting concrete courses.
- [ ] Run planner and regression tests until green, then run the existing planner suite.

### Task 3: Accepted-plan state and eight-semester rendering

**Files:**
- Modify: `planner-state-logic.js`
- Modify: `worker/tests/planner-state-logic.test.mjs`
- Modify: `index.html`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

- [ ] Add a failing state test proving accepted generation replaces unlocked placements, preserves explicit pins, keeps generated entries unlocked, and persists typed placeholders.
- [ ] Add a failing UI contract test proving the accepted preview is rendered in its assigned year/semester and titles remain present.
- [ ] Verify the tests fail against the current state merger/UI acceptance code.
- [ ] Add a durable `userPinned` migration separate from legacy builder state.
- [ ] Update `withAcceptedPlan()` to merge explicit pins over generated results and persist placeholders.
- [ ] Remove the UI's forced `locked:true` rewrite during preview acceptance.
- [ ] Render persisted placeholders and canonical titles in every year view.
- [ ] Ensure acceptance saves state, closes the modal, selects a populated year when appropriate, and calls one coherent render.
- [ ] Run state/UI integration tests and a pure end-to-end adapter → engine → acceptance test.

### Task 4: Baseline integration and browser verification

**Files:**
- Modify only files required by failures found during verification.

- [ ] Run `node --test worker/tests/*.test.mjs` and `git diff --check`.
- [ ] Start a local static server and load the app in the browser.
- [ ] Exercise onboarding through program selection, generate a plan, accept it, and inspect all four year views.
- [ ] Verify no semester exceeds 18 credits or 6 entries, no generated entry is automatically pinned, and placeholders persist.
- [ ] Verify regeneration preserves only explicit pins.
- [ ] Commit the verified planner repair on `codex/planner-repair-sequential`.
- [ ] Merge to `dev` only after the repair is verified; do not touch `main` or production.
