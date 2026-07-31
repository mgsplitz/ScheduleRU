# Planner Follow-up System Fixes

**Goal:** Repair the shared planner and onboarding paths behind the July 30 bug report without adding course-specific exceptions.

## Root causes

1. `planner-input-logic.js` infers a placeholder's type from `sourceProgram`. Core groups carry their real backend `program_id`, so generated Core placeholders are mislabeled as program requirements and their **Choose** action opens the wrong destination.
2. Completed-course onboarding renders matches only through a native `datalist`. The catalog query and ranking work, but the browser controls whether the suggestions are visibly presented.
3. Raw Rutgers catalog prerequisites include valid alternatives from other campuses and prerequisite leaves that are outside the selected reviewed planning universe. The planner currently treats all safely parsed raw paths as hard constraints. This can assign an infinite earliest term to otherwise schedulable New Brunswick courses.
4. Planned schedule entries are not expanded through reviewed equivalencies before prerequisite evaluation. A scheduled alternative can fulfill a degree requirement while still appearing missing to a dependent course.

## Implementation

### 1. Preserve requirement type independently from ownership

- Modify `planner-input-logic.js`.
- Pass `sourceType` separately through requirement collection and placeholder creation.
- Keep `sourceProgram` for ownership/tab selection only.
- Reclassify older saved Core placeholders after the Core curriculum loads so existing browser plans do not need to be regenerated.
- Add a regression where a Core group has a non-`core` backend `sourceProgramId`.

### 2. Scope catalog prerequisite paths safely

- Modify `eligibility-logic.js` with pure helpers that classify Rutgers campus code prefixes and retain paths relevant to the target course's campus.
- Modify `planner-input-logic.js` so raw catalog paths are hard-enforced only when every course in the path is completed or represented in the selected reviewed program/Core trees.
- Preserve reviewed prerequisite conditions as hard constraints.
- Mark raw catalog rules with no enforceable in-universe path as unresolved/advisory rather than declaring the four-year plan impossible.
- Add a BAIT/Finance-shaped regression proving that a calculus choice, `33:136:385`, and `33:136:485` are placed in prerequisite order.

### 3. Expand planned equivalents for prerequisite checks

- Modify `academic-credit-logic.js` with a pure planned-entry expansion helper.
- Modify `index.html` to use expanded zero-credit aliases for eligibility matching while counting each scheduled course's credits only once.
- Add tests for term preservation, equivalency closure, and no credit duplication.

### 4. Render explicit onboarding search results

- Modify `index.html` to render a bounded, keyboard-safe result list under the search field.
- Keep exact-code and Enter behavior.
- Add click selection and accessible status/results markup.
- Add integration coverage so the UI cannot regress to a native-only `datalist`.

### 5. Verification and release

- Run focused tests after each change.
- Run `node --test worker/tests/*.test.mjs`, syntax checks, and `git diff --check`.
- Deploy only the public development Pages bundle after verification because this batch does not change Worker code or D1 data, then push the branch and `dev` as authorized by the user's established workflow.
