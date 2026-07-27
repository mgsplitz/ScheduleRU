# Systemic Planner Corrections Implementation Plan

> Execute sequentially with strict test-first checkpoints. Do not call the paid
> OpenAI API; inject a fake upstream fetch in tests.

**Goal:** Fix every reported PDF regression through shared requirement, credit,
provenance, and UI contracts rather than course-specific browser conditionals.

**Architecture:** Add a pure academic-credit closure module and preserve program
ownership during requirement-family normalization. Keep course facts in D1
migrations, then adapt existing UI flows to those shared contracts.

**Stack:** Browser JavaScript, Node test runner, Cloudflare Workers/D1, Responses
API structured output.

---

## Task 1: Canonical academic-credit closure

**Files**

- Create: `academic-credit-logic.js`
- Create: `worker/tests/academic-credit-logic.test.mjs`
- Modify: `index.html`
- Modify: `planner-input-logic.js`
- Modify: `worker/tests/planner-input-logic.test.mjs`

1. Write failing tests showing that a completed alternative closes canonical
   requirements transitively and that unrelated alternatives do not apply.
2. Run the two focused test files and confirm the new test fails.
3. Implement a pure resolver that derives equivalency edges from loaded trees and
   returns the fixed-point set of satisfied course codes.
4. Route requirement completion, prerequisite evaluation, and planner inputs
   through the same closure.
5. Run the focused tests and confirm they pass.

## Task 2: Preserve shared-family ownership

**Files**

- Modify: `requirement-group-logic.js`
- Modify: `worker/tests/requirement-display-logic.test.mjs`
- Modify: `index.html`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

1. Write a failing behavior test proving that a selected representative root
   retains every program that contributed the same display family.
2. Implement non-mutating owner aggregation during display-family deduplication.
3. Propagate owner IDs into normalized groups and use them for program-tab
   filtering.
4. Add the shared-major auto-collapse presentation without changing completion
   state.
5. Run focused display/UI tests.

## Task 3: Correct picker, path, placeholder, and preflight flows

**Files**

- Create: `planner-ui-logic.js`
- Create: `worker/tests/planner-ui-logic.test.mjs`
- Modify: `index.html`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`

1. Write failing pure behavior tests for independent Wishlist state, placeholder
   dispatch, honest course-path state, and incomplete-Core preflight decisions.
2. Implement small pure decision helpers in `planner-ui-logic.js`.
3. Render independent requirement and Wishlist buttons with immediate state.
4. Make every course details modal render one Course path state.
5. Dispatch finite placeholders to the requirement picker and selector-backed
   placeholders to the catalog browser.
6. Replace plan generation with a single guarded preflight flow.
7. Run focused UI tests.

## Task 4: Decouple additional programs from home school

**Files**

- Modify: `index.html`
- Modify: `worker/tests/hackathon-ui-integration.test.mjs`
- Modify: `worker/tests/program-selection-policy.test.mjs` only if a missing
  policy boundary is exposed

1. Add a failing integration test proving program discovery is unscoped while the
   selection check still sends the unchanged home school.
2. Load all published supported programs, then apply existing reviewed
   home-school eligibility filters.
3. Verify changing selected programs does not reload or replace the home-school
   Core.
4. Run focused UI and selection-policy tests.

## Task 5: Store systemic RBS equivalency data

**Files**

- Create: `worker/schema/review_rbs_foundational_equivalencies.sql`
- Modify: `worker/tests/ap-equivalencies.test.mjs`
- Modify: `worker/tests/reviewed-requirement-metadata.test.mjs`

1. Add failing migration tests for the reviewed `01:198:111 → 01:198:170` and AP
   Statistics `01:960:211 → 01:960:285` relationships.
2. Write idempotent D1 data changes with provenance notes; do not hardcode either
   relationship in browser logic.
3. Run focused schema and academic-credit tests.

## Task 6: Bound and configure the schedule assistant

**Files**

- Modify: `worker/src/schedule-assistant.js`
- Modify: `worker/tests/schedule-assistant.test.mjs`

1. Add a failing test for a bounded output-token request.
2. Add the smallest safe output ceiling while retaining Luna, low reasoning,
   structured output, and `store: false`.
3. Run the assistant tests with fake upstream responses only.

## Task 7: Verification and development deployment

1. Run all focused tests touched above.
2. Run `node --test worker/tests/*.test.mjs`.
3. Run `git diff --check` and inspect the complete diff.
4. Start a local static server and perform one browser smoke pass covering the
   reported flows.
5. Commit implementation in coherent checkpoints.
6. Apply the new D1 migration to `rutgers_courses_dev`.
7. Install `OPENAI_API_KEY` interactively as an encrypted `--env dev` secret,
   without placing the value in command history or output.
8. Deploy the development Worker and Pages branch.
9. Report the dev URL and wait for user approval; do not merge to `main` or deploy
   production.
