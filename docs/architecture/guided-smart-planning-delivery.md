# Guided Smart Planning Delivery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided, plain-language four-year planning workflow that resolves requirement choices correctly, recommends policy-valid overlapping courses, and supports scalable curriculum freshness and program expansion.

**Architecture:** Add pure requirement-choice and candidate-optimization models between requirement evaluation and the existing semester sequencer. Keep browser orchestration thin by giving choice transactions, guided generation, and user-facing issue copy dedicated controllers/models. Extend the existing catalog/source contracts for structured Core attributes, catalog-year versions, fingerprints, and conflict evidence rather than embedding curriculum content in application code.

**Tech Stack:** Browser-native JavaScript, Node test runner, Cloudflare Workers/D1, TypeScript catalog contracts, reviewed JSONL snapshots, existing ScheduleRU package boundaries.

## Global Constraints

- Work on task branches; production deployment and production D1 changes require explicit approval.
- Preserve local browser storage and guest operation.
- Degree-specific and Business elective choices cannot be deferred; eligible SAS Core choices may be deferred.
- Delegated choices must be concrete, explained, and approved.
- Never expose raw HTTP bodies, stack traces, parser language, or solver language to students.
- Do not scrape RateMyProfessors; use external profile/search links only.
- Catalog content belongs in catalog artifacts, never application code or structural migrations.
- Run `npm test`, `npm run typecheck`, and `git diff --check` at every release checkpoint.

---

## Release 1 — Trustworthy choices and understandable failures

### Task 1: Requirement-choice transaction

**Files:**
- Create: `apps/web/src/requirement-choice-model.js`
- Modify: `apps/web/src/planner-controller.js`
- Modify: `apps/web/src/catalog-page-controller.js`
- Modify: `apps/web/src/planner-state-store.js`
- Test: `worker/tests/requirement-choice-model.test.mjs`
- Test: `worker/tests/catalog-page-controller.test.mjs`
- Test: `worker/tests/planner-correctness-regression.test.mjs`

**Interfaces:**
- Produces: `createIntent({ placeholder, group, returnPage })`, `courseMatchesIntent(course, intent, selectorLogic)`, and `commitChoice({ intent, courseId, groupSelections })`.
- `commitChoice` returns `{ groupSelections, resolvedPlaceholderId, returnPage }` without mutating its input.

- [x] Write failing tests proving that a Core placeholder creates a persistent intent, a matching course commits to the originating group, a nonmatching course is rejected, and the matching placeholder disappears from rebuilt planner input.
- [x] Run `node --test worker/tests/requirement-choice-model.test.mjs worker/tests/catalog-page-controller.test.mjs worker/tests/planner-correctness-regression.test.mjs`; verify the new cases fail because `ScheduleRURequirementChoiceModel` is absent.
- [x] Implement the pure model and persist only the active intent; do not use wishlist state as requirement state.
- [x] Replace the filtered catalog’s primary `+ Wishlist` action with `Use for this requirement` while retaining a separate wishlist action.
- [x] Commit the selection, rebuild planner input, return to the planner, and focus the resolved semester location.
- [x] Run the focused tests and verify all pass.
- [x] Commit with `git commit -m "fix(web): resolve planner choices transactionally"`.

### Task 2: Composable catalog filters and Core badges

**Files:**
- Create: `apps/web/src/catalog-filter-model.js`
- Modify: `apps/web/src/catalog-page-controller.js`
- Modify: `apps/web/styles/app.css`
- Modify: `apps/api/src/worker.js`
- Modify: `apps/api/src/programs/storage/public-program-repository.js`
- Create: `migrations/schema_course_requirement_attributes.sql`
- Test: `worker/tests/catalog-page-controller.test.mjs`
- Test: `worker/tests/catalog-selector-api.test.mjs`
- Test: `worker/tests/course-selector-integration.test.mjs`

**Interfaces:**
- Produces `CatalogFilterState = { search, subject, levels, credits, availability, requirementIntentId, coreCodes }`.
- Public courses API accepts all fields concurrently and returns `attributes: string[]` per course.

- [x] Add failing API and controller tests for an active WCr intent combined with subject, search, and course-level filters.
- [x] Add the structural attribute table and derive its content from published reviewed Core requirement groups during catalog publication; do not insert course content in the migration.
- [x] Extend `/api/courses` to join/filter normalized attributes and return stable badge codes.
- [x] Render removable filter chips and keep every traditional control visible while a requirement intent is active.
- [x] Render subtle accessible Core badges beside course titles.
- [x] Run the focused catalog/API tests and commit with `git commit -m "feat(catalog): compose requirement and course filters"`.

### Task 3: Plain-language issue presentation

**Files:**
- Create: `apps/web/src/user-message-model.js`
- Modify: `apps/web/src/backend-client.js`
- Modify: `apps/web/src/planner-ui-logic.js`
- Modify: `apps/web/src/planner-controller.js`
- Modify: `apps/web/src/guided-setup-controller.js`
- Test: `worker/tests/user-message-model.test.mjs`
- Test: `worker/tests/backend-client.test.mjs`
- Test: `worker/tests/advisory-policy-ui.test.mjs`

**Interfaces:**
- Produces `presentIssue(issue) -> { title, message, primaryAction, secondaryAction?, detail? }`.
- `fetchJson` throws `{ code, status, retryable, detail }`; response bodies stay in `detail` and are never rendered by default.

- [ ] Write failing tests for 404, offline, invalid response, plan capacity, prerequisite sequence, source conflict, and unknown error presentations.
- [ ] Require every presentation to use an eighth-grade reading target, one recommended action, and no raw JSON/HTTP prefix in title or message.
- [ ] Implement the structured backend error and presentation catalog with a safe unknown fallback.
- [ ] Replace planner/onboarding raw error interpolation with message cards whose technical detail is collapsed and development-only.
- [ ] Group repeated issues by recovery action and cap the initial display at three groups.
- [ ] Run focused tests and commit with `git commit -m "feat(web): present actionable student-friendly errors"`.

**Release 1 checkpoint:** Manually verify Core Choose → filtered Courses → Use for requirement → placeholder removed; combine WCr with subject/search; simulate offline and 404 responses. Then run the global verification commands.

---

## Release 2 — Guided generation and concrete electives

### Task 4: Requirement planning-mode classifier

**Files:**
- Create: `packages/planner/src/requirement-choice-logic.js`
- Modify: `packages/planner/package.json`
- Modify: `packages/planner/src/planner-input-logic.js`
- Test: `worker/tests/requirement-choice-logic.test.mjs`
- Test: `worker/tests/planner-input-logic.test.mjs`

**Interfaces:**
- Produces `classifyRequirement(group, candidates) -> "fixed" | "sequence_critical" | "guided_flexible" | "reserve_only"`.
- Produces `planningDecisions(plannerInput) -> Decision[]`, where each decision includes candidate prerequisite summaries and `canDefer`.

- [ ] Write failing cases showing that finite major electives with differing prerequisite closures are sequence-critical, equivalent paths are fixed, SAS Core pools are guided-flexible, and unreviewed open text is reserve-only.
- [ ] Implement deterministic classification from reviewed data only.
- [ ] Add classified decisions to planner input without changing current plan generation behavior.
- [ ] Run focused tests and commit with `git commit -m "feat(planner): classify unresolved planning decisions"`.

### Task 5: Generation decision dialog

**Files:**
- Create: `apps/web/src/generation-decisions-controller.js`
- Create: `apps/web/src/generation-decisions-view.js`
- Modify: `apps/web/src/planner-controller.js`
- Modify: `apps/web/src/planner-state-store.js`
- Modify: `apps/web/styles/app.css`
- Test: `worker/tests/generation-decisions-controller.test.mjs`
- Test: `worker/tests/planner-state-store.test.mjs`

**Interfaces:**
- Consumes `Decision[]` from Task 4.
- Produces `ChoicePreferences = { [groupId]: { interested: string[], maybe: string[], avoid: string[], mode: "ranked" | "recommend_for_me" | "deferred" } }`.

- [ ] Write failing controller tests for Business-first ordering, interested/maybe/avoid mutation, nondeferrable business decisions, deferrable SAS Core decisions, and persisted restart behavior.
- [ ] Render generation as a short sequence of focused cards rather than one dense modal; show candidate prerequisite burden and overlap badges in plain language.
- [ ] Require a ranked preference or `Choose for me` for degree-specific decisions.
- [ ] Show `I'll do this later` only for `canDefer` Core decisions.
- [ ] Persist draft preferences locally and allow Back without losing work.
- [ ] Run focused tests and commit with `git commit -m "feat(web): guide elective decisions during generation"`.

---

## Release 3 — Policy-aware overlap optimization

### Task 6: Candidate coverage graph

**Files:**
- Create: `packages/requirements/src/candidate-coverage-model.js`
- Modify: `packages/requirements/package.json`
- Modify: `packages/requirements/src/program-requirement-model.js`
- Test: `worker/tests/candidate-coverage-model.test.mjs`

**Interfaces:**
- Produces `buildCoverageGraph({ trees, decisions, equivalencies, coreAttributes, policies }) -> { requirements, candidates, conflicts }`.
- Each candidate records covered group IDs, credits, prerequisite closure, interest rank, reviewed allocation constraints, and offering evidence.

- [ ] Write failing tests for CS satisfying an RBS computing alternative, AH+WCr coverage, illegal major/minor overlap, equivalency credit deduplication, and unknown policy conflicts.
- [ ] Build a normalized graph without modifying requirement trees.
- [ ] Treat missing double-count authority as a conflict requiring review, never implicit permission.
- [ ] Run tests and commit with `git commit -m "feat(requirements): build reviewed candidate coverage graph"`.

### Task 7: Deterministic course-set optimizer

**Files:**
- Create: `packages/planner/src/course-set-optimizer.js`
- Modify: `packages/planner/package.json`
- Test: `worker/tests/course-set-optimizer.test.mjs`
- Test: `worker/tests/planner-correctness-regression.test.mjs`

**Interfaces:**
- Produces `optimizeCourseSet(graph, preferences) -> { status, selectedCourses, deferredRequirements, explanations, issues }`.
- Objective order is mandatory coverage, legal allocation, minimum extra credits, maximum overlap, interest, minimum prerequisite burden, offering feasibility, stable course-code tie-break.

- [ ] Write failing tests for each objective independently and one combined BAIT/Finance/minor fixture.
- [ ] Implement bounded deterministic branch-and-bound search over unresolved candidates, with an explicit safety limit returning `indeterminate` rather than a guessed plan.
- [ ] Emit explanation facts, not UI prose: covered groups, avoided redundant courses, prerequisite additions, and violated preferences.
- [ ] Prove identical inputs return byte-equivalent selections.
- [ ] Run tests and commit with `git commit -m "feat(planner): optimize policy-valid course overlap"`.

### Task 8: Recommendation approval and semester sequencing

**Files:**
- Modify: `apps/web/src/generation-decisions-controller.js`
- Modify: `apps/web/src/generation-decisions-view.js`
- Modify: `packages/planner/src/planner-input-logic.js`
- Modify: `packages/planner/src/four-year-planner-logic.js`
- Modify: `apps/web/src/planner-controller.js`
- Test: `worker/tests/generation-decisions-controller.test.mjs`
- Test: `worker/tests/planner-correctness-regression.test.mjs`
- Test: `worker/tests/four-year-planner-logic.test.mjs`

**Interfaces:**
- Consumes optimizer result from Task 7.
- Produces approved concrete planner input plus explicit deferred Core reserves.

- [ ] Write a failing end-to-end test showing `Choose for me` recommends concrete electives, explains overlap/prerequisites, waits for approval, and only then calls the semester sequencer.
- [ ] Present no more than one short explanation and one tradeoff per recommended course, with expandable detail.
- [ ] Support replacing a recommendation before approval without restarting the entire dialog.
- [ ] Feed approved concrete selections into prerequisite sequencing and retain only explicitly deferred SAS Core placeholders.
- [ ] Verify a rejected recommendation cannot enter accepted planner state.
- [ ] Run focused and global tests; commit with `git commit -m "feat(planner): approve optimized electives before sequencing"`.

**Release 3 checkpoint:** Test CS+Finance and BAIT+Finance+multiple-minor scenarios against fixtures; verify no redundant equivalent course, illegal overlap, anonymous business elective, or prerequisite inversion appears.

---

## Release 4 — Minimal requirements workspace and onboarding

### Task 9: Program-oriented requirement subtabs

**Files:**
- Modify: `apps/web/src/required-panel-controller.js`
- Modify: `packages/requirements/src/program-requirement-model.js`
- Modify: `apps/web/styles/app.css`
- Test: `worker/tests/required-panel-controller.test.mjs`
- Test: `worker/tests/program-requirement-model.test.mjs`

**Interfaces:**
- Produces `requirementTabs({ homeSchool, programs, sharedRoots })` ordered as shared school requirements, primary major, secondary major, minors.
- Produces `nextActions(progress)`, capped at three actions.

- [ ] Write failing tests for RBS Core, two majors, three minors, faded-but-accessible minor tabs, preserved active tab, and a three-item Next up summary.
- [ ] Render shared school requirements once rather than under every major.
- [ ] Keep SAS Core in the existing Core area and make requirement groups collapsed by default except the first actionable group.
- [ ] Remove repetitive instructional prose from each panel and place guidance in the contextual Next up summary.
- [ ] Run tests and commit with `git commit -m "feat(web): organize requirements by program"`.

### Task 10: Reordered honest onboarding

**Files:**
- Modify: `apps/web/src/guided-setup-controller.js`
- Modify: `apps/web/src/program-picker-controller.js`
- Modify: `apps/web/src/program-picker-logic.js`
- Modify: `apps/web/styles/app.css`
- Test: `worker/tests/hackathon-ui-integration.test.mjs`
- Test: `worker/tests/program-picker-controller.test.mjs`

**Interfaces:**
- Onboarding order: Welcome, Programs, Coursework, AP, Review.
- Major roles display `Primary` and `Secondary`; only the small `Make primary` action changes roles.

- [ ] Replace source-pattern onboarding assertions with controller behavior tests for forward/back navigation and persisted data.
- [ ] Render disabled `Create account` with `Coming soon` and active `Continue locally`.
- [ ] Move home school/programs ahead of coursework and AP.
- [ ] Keep verified manual course search; provide transcript/AP upload entry points that clearly state supported behavior and never imply parsing succeeded when it did not.
- [ ] Add Fall/Spring/Summer/Winter labels to organized manual history without implementing transcript parsing.
- [ ] Run tests and commit with `git commit -m "feat(web): reorder and simplify onboarding"`.

### Task 11: External RateMyProfessors links

**Files:**
- Modify: `apps/web/src/course-details-controller.js`
- Modify: `apps/web/src/schedule-builder-view.js`
- Test: `worker/tests/course-details-controller.test.mjs`
- Test: `worker/tests/schedule-builder-view.test.mjs`

**Interfaces:**
- Produces an external search URL from the displayed instructor name and Rutgers University; stores no ratings.

- [ ] Write tests that omit links for Staff/TBA and safely encode named instructors.
- [ ] Add `View professor ratings ↗` with an explicit external-site label and `rel="noopener noreferrer"`.
- [ ] Run tests and commit with `git commit -m "feat(web): link to external professor ratings"`.

---

## Release 5 — Curriculum freshness without full rescapes

### Task 12: Versioned source observations and conflicts

**Files:**
- Modify: `packages/catalog-sources/src/model.ts`
- Modify: `packages/catalog-sources/src/validation.ts`
- Modify: `packages/catalog-sources/src/exporter.ts`
- Modify: `packages/catalog-sources/src/publisher.ts`
- Create: `migrations/schema_catalog_source_observations.sql`
- Modify: `apps/api/src/programs/services/requirement-import-service.js`
- Modify: `apps/api/src/programs/storage/requirement-candidate-repository.js`
- Test: `packages/catalog-sources/test/validation.test.ts`
- Test: `worker/tests/program-requirement-source-integration.test.mjs`

**Interfaces:**
- Adds `SourceObservation = { source_id, observed_at, content_hash, authority, effective_catalog_year, status, conflict_group }`.
- Import service returns `unchanged`, `changed`, or `conflict`; only `changed` enqueues extraction.

- [ ] Write contract and service tests for unchanged fingerprints, changed public pages, a Degree Navigator/manual observation conflict, and separate catalog-year versions.
- [ ] Add structural tables only; keep observations and curriculum facts in published artifacts/admin workflows.
- [ ] Persist response fingerprints and short-circuit unchanged sources.
- [ ] Retain conflicting assertions and require a reviewed resolution rather than applying last-write-wins.
- [ ] Run package and integration tests; commit with `git commit -m "feat(catalog): track versioned source changes and conflicts"`.

### Task 13: Shared curriculum references

**Files:**
- Modify: `packages/catalog/src/model.ts`
- Modify: `packages/catalog/src/validation.ts`
- Modify: `packages/catalog/src/publisher.ts`
- Modify: `apps/api/src/programs/storage/public-program-repository.js`
- Modify: `packages/requirements/src/requirement-tree-builder.js`
- Test: `packages/catalog/test/validation.test.ts`
- Test: `worker/tests/curriculum-module-migration.test.mjs`
- Test: `worker/tests/program-requirement-model.test.mjs`

**Interfaces:**
- Programs reference versioned `shared_requirement_set` definitions by ID and catalog year.
- Requirement-tree builder resolves shared modules before display/planning and retains source ownership.

- [ ] Write failing tests proving six RBS majors reference one RBS Core version while an older admitted student resolves the prior version.
- [ ] Extend the catalog contract and publisher without embedding shared course lists in program rows.
- [ ] Resolve shared modules at the repository/tree boundary and remove presentation-time duplicate guessing for migrated definitions.
- [ ] Publish the reviewed Degree Navigator RBS change as a new version only after its effective year/source is recorded.
- [ ] Run tests and commit with `git commit -m "feat(catalog): version shared curriculum modules"`.

**Release 5 checkpoint:** Run a dry-run fingerprint scan, prove unchanged sources cause zero extraction work, and review the conflict report before any dev D1 publication.

---

## Release 6 — All Rutgers programs

### Task 14: School-by-school program coverage pipeline

**Files:**
- Modify: `packages/catalog-sources/src/model.ts`
- Modify: `catalog/snapshots/reviewed-catalog-sources.v1.json`
- Modify: `tools/catalog/README.md`
- Modify: `docs/catalog-contributor/README.md`
- Test: `worker/tests/catalog-source-portability.test.mjs`
- Test: `worker/tests/program-catalog-publication.test.mjs`
- Test: `worker/tests/repository-hygiene.test.mjs`

**Interfaces:**
- Every source adapter emits the existing validated `ProgramDefinition` contract.
- Coverage report groups programs by `catalog_listed`, `unreviewed`, `reviewed`, `needs_fix`, and catalog year.

- [ ] Add a failing portable-source test for a second school adapter without changing application code.
- [ ] Add source registry metadata for one school at a time, starting with SOE and SEBS, then remaining New Brunswick schools.
- [ ] Generate catalog-listed identities first; promote requirement trees only after evidence validation.
- [ ] Add coverage reporting and require zero invalid definitions before publishing a batch.
- [ ] Process each school as a separately reviewable batch; never block product releases on total Rutgers completion.
- [ ] Run global verification after every school and commit each school independently, beginning with `data(catalog): add reviewed SOE programs` and `data(catalog): add reviewed SEBS programs`.

## Final acceptance

- [ ] Run `npm test` and record zero failures.
- [ ] Run `npm run typecheck` and record zero errors.
- [ ] Run `git diff --check` and record no whitespace errors.
- [ ] Complete desktop exploratory tests for onboarding, multi-program requirements, choice resolution, delegated recommendations, plan acceptance, catalog filters, offline errors, and restart persistence.
- [ ] Confirm no production deployment or production D1 mutation occurred without explicit approval.
- [ ] Update `README.md` only with user-facing capabilities that are actually implemented and verified.
