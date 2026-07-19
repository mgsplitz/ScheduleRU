# SAS pilot implementation plan

## Purpose and boundary

Build the reusable requirement-engine foundation required for the approved Rutgers–New Brunswick SAS pilot. The pilot is deliberately **not** a public SAS release yet. It must not expose unverified Political Science categories or present policy advisories as automatic audit decisions.

The reviewed pilot design is at `docs/superpowers/specs/2026-07-19-sas-pilot-design.md`; source coverage and unresolved evidence are at `SAS_PILOT_SOURCE_INVENTORY.md`.

## Prerequisites before any SAS program is selectable

1. Record a current official source that maps every eligible Political Science course to the three in-depth areas. The currently reviewed department pages name the areas but do not provide a membership table. Do not infer the mapping from course titles or old catalogs.
2. Complete the required provenance row for each imported program, group, course, and policy restriction: source URL, catalog year/effective date, retrieval date, review status, and reviewer note.
3. Review exact program-level policies that the app can evaluate. Keep grade, residency, advising approval, and transfer restrictions as advisory unless the student-record model and source evidence make deterministic evaluation safe.

## Task 1 — Reusable credit-count groups

**Files:** `requirement-group-logic.js`, `worker/src/programs.js`, `index.html`, existing group tests.

1. Write failing tests for `min_credits` and `max_credits` group constraints, including courses with different credit values and a partially completed group.
2. Extend normalized requirement groups to carry reviewed credit constraints without changing existing course-count behavior.
3. Return and render group progress as both course count and credits where a reviewed group specifies credit constraints.
4. Verify the existing RBS requirement display and allocation tests remain unchanged.

**Acceptance:** a future SAS elective group can require, for example, 15 credits with a 12-credit upper-level minimum without hard-coded UI logic.

## Task 2 — Exclusive allocation families

**Files:** new pure browser/shared logic module, `requirement-group-logic.js`, `worker/src/programs.js`, `index.html`, focused tests.

1. Write failing tests for one course that appears in two groups but may count in only one, including a case where reallocating it produces a better completion outcome.
2. Add a reviewed `allocation_family` / `max_uses` condition model. Preserve present behavior unless a reviewed condition exists.
3. Implement deterministic, explainable allocation: prefer satisfying a required group, then the allocation which maximizes total completed requirements, with a stable tie-breaker.
4. Show the selected allocation and a short explanation; do not hide other eligible choices in the group browser.

**Acceptance:** future PPE cross-listed courses, Core families, and non-double-count rules can be represented by reviewed data instead of program-specific code.

## Task 3 — Advisory-only policy messages

**Files:** worker program schema/API, requirement UI, tests.

1. Write tests that distinguish a blocking reviewed academic rule from an advising-only policy.
2. Support structured advisory conditions for `minimum_course_grade`, `nb_residency_limit`, `requires_school_approval`, and `transfer_limit`.
3. Render concise, user-facing wording that says what the student should do and never calls an advisory a degree audit.

**Acceptance:** PPE’s C+ / outside-NB limits and RBS-to-SAS approval caveat are visible without falsely accepting or rejecting a plan.

## Task 4 — Evidence-gated program records

**Files:** program seed data/schema, source inventory, tests.

1. Add only fully sourced reviewed PPE program/group/course rows, using the finite lists from the current department page.
2. Keep Political Science hidden until the official area-membership mapping is documented. Add an explicit source-inventory blocker rather than partial program data.
3. Attach SAS wording (`Major`, `Minor`) and Rutgers–NB scope to the program profile, keeping the existing Programs modal as the single entry point.
4. Add integration tests covering source-review status, no unpublished cross-campus courses, and program selection eligibility.

**Acceptance:** the UI cannot offer a partially audited program merely because some requirements are known.

## Task 5 — Human review and dev-only release

1. Run all tests and add exact manual cases for SAS-only, RBS+SAS, no source, course-allocation conflict, and advisory message behavior.
2. Populate only the development D1 database after the data review is approved.
3. Deploy only the dev Worker and dev Pages branch, preserving secrets with `--keep-vars`.
4. Review in the browser with a real test plan before asking to publish production.

## Deferred by design

- Rutgers–New Brunswick automatic eight-semester schedule generation.
- AI schedule permutations, natural-language course recommendations, accounts, document uploads, and other Rutgers schools/campuses.
- Automated enforcement of policies whose official sources require human approval or individual transcript evaluation.
