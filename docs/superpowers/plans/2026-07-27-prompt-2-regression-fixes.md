# Prompt 2 Regression Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the current-semester builder, requirement progress, and simultaneously planned equivalency regressions from `prompt-2.pdf`.

**Architecture:** Keep term authorization and progress composition in the existing pure UI module, and keep equivalency closure in the existing academic-credit module. `index.html` consumes those decisions without gaining course-code branches. Statistical Methods in Business remains unchanged.

**Tech Stack:** Browser-native HTML/CSS/JavaScript, Node test runner, Cloudflare Worker/Pages.

## Global Constraints

- Execute inline and sequentially; the user prohibited agents.
- Do not modify `main` or production.
- Do not add an equivalency for `33:136:385`.
- Do not call the paid OpenAI API.
- Follow strict red-green TDD for each behavior.

---

### Task 1: Current-semester builder visibility

**Files:**
- Modify: `index.html`
- Test: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Consumes: `ScheduleRUPlannerUI.canOpenSemesterBuilder({ displayedYear, activeYear, semester, activeSemester }): boolean`
- Produces: a hidden, disabled non-current button and one visible, enabled current-term button.

- [ ] **Step 1: Add the failing regression assertion**

Extend the current-semester integration test with:

```js
assert.match(html, /\.sem-plus\[hidden\]\{display:none;\}/);
```

This catches an author `display:inline-flex` rule overriding the browser's
native `[hidden]` behavior.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test worker/tests/hackathon-ui-integration.test.mjs
```

Expected: FAIL because `.sem-plus[hidden]` has no authoritative display rule.

- [ ] **Step 3: Implement the minimum CSS fix**

Add this immediately after the `.sem-plus` display rule:

```css
.sem-plus[hidden]{display:none;}
```

Keep the existing JavaScript `hidden` and `disabled` assignments and
`openBuilder` authorization guard unchanged.

- [ ] **Step 4: Verify GREEN**

Run the same focused test. Expected: PASS.

### Task 2: Requirement-selection progress

**Files:**
- Modify: `planner-ui-logic.js`
- Modify: `index.html`
- Test: `worker/tests/planner-ui-logic.test.mjs`

**Interfaces:**
- Produces: `requirementProgressCourseIds({ appliedIds?: string[], selectedIds?: string[] }): string[]`
- Consumes in `groupHtml`: `groupAppliedCourseIds(g)` and `selectedRequirementCourses(g.id)`.

- [ ] **Step 1: Add the failing pure behavior test**

```js
test("requirement progress counts selected and applied courses once", () => {
  assert.deepEqual(logic.requirementProgressCourseIds({
    appliedIds: ["financeA", "financeB"],
    selectedIds: ["financeB", "financeC"],
  }), ["financeA", "financeB", "financeC"]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test worker/tests/planner-ui-logic.test.mjs
```

Expected: FAIL because the helper is not defined.

- [ ] **Step 3: Implement and consume the helper**

Add:

```js
function requirementProgressCourseIds({ appliedIds = [], selectedIds = [] } = {}) {
  return [...new Set([...appliedIds, ...selectedIds].filter(Boolean))];
}
```

Export it from `ScheduleRUPlannerUI`. In `groupHtml`, compute:

```js
const progressCourseIds = ScheduleRUPlannerUI.requirementProgressCourseIds({
  appliedIds: applied,
  selectedIds: selectedRequirementCourses(g.id),
});
```

Use `progressCourseIds.length` for non-credit selector and explicit count
labels. Keep `groupFulfilled` and credit progress based on applied courses.

- [ ] **Step 4: Verify GREEN**

Run the focused UI-logic and UI-integration tests. Expected: PASS.

### Task 3: Simultaneously planned reviewed equivalents

**Files:**
- Modify: `academic-credit-logic.js`
- Modify: `planner-input-logic.js`
- Test: `worker/tests/academic-credit-logic.test.mjs`
- Test: `worker/tests/planner-input-logic.test.mjs`

**Interfaces:**
- Produces: `redundantCanonicalCourseCodes({ courseCodes?: string[], requirementTrees?: object[] }): Set<string>`
- Consumes: the reviewed directed edges already returned by `equivalencyEdges`.

- [ ] **Step 1: Add the failing academic-credit test**

Create a fixture where required `01:198:111` is a reviewed alternative for
required `01:198:170`, then assert:

```js
assert.deepEqual([...logic.redundantCanonicalCourseCodes({
  courseCodes: ["01:198:111", "01:198:170"],
  requirementTrees: [tree],
})], ["01:198:170"]);
```

- [ ] **Step 2: Add the failing planner-input regression test**

Build a requirement tree that contains both courses as concrete requirements
and assert the planner emits `01:198:111` but not `01:198:170`. Also assert
that an unrelated `33:136:385` requirement remains in the output.

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test worker/tests/academic-credit-logic.test.mjs worker/tests/planner-input-logic.test.mjs
```

Expected: FAIL because both future equivalent courses are currently emitted.

- [ ] **Step 4: Implement generic redundancy detection**

For every concrete course code, traverse `equivalencyEdges` transitively. Add
canonical targets to the redundant set only when the target is also in the
concrete course-code set and differs from the starting course. Export the
helper.

After all requirement/core inputs are collected in `buildPlannerInput`, call
the helper with `requirementCourses.keys()` and delete every returned canonical
code before normalization.

- [ ] **Step 5: Verify GREEN**

Run both focused test files. Expected: PASS, including the explicit
`33:136:385` preservation assertion.

### Task 4: Full verification and dev release

**Files:**
- Modify only if verification exposes a regression.

**Interfaces:**
- Produces: a clean feature commit deployed to `dev`; no `main` change.

- [ ] **Step 1: Run syntax and complete automated checks**

```bash
git diff --check
node --check academic-credit-logic.js
node --check planner-input-logic.js
node --check planner-ui-logic.js
node --test worker/tests/*.test.mjs
```

Expected: zero failures.

- [ ] **Step 2: Browser-smoke the deployed behavior**

Verify that only the current term displays a `+`, clicking it opens the
semester builder, Finance elective selection changes `0/4` to `1/4`, and a
generated plan containing Intro to Computer Science omits Computer Applications
for Business.

- [ ] **Step 3: Commit and deploy to dev**

Commit implementation and tests, push `codex/systemic-planner-fixes`, deploy
the dev Worker only if Worker code/config changed, then fast-forward `dev`.
Confirm Pages serves the exact commit. Do not change `main` or production.
