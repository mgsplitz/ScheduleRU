# Logic Invariants Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix regeneration equivalencies, catalog prerequisite parsing, current-semester builder visibility, and wishlist toggling without changing reviewed Finance requirements.

**Architecture:** Keep academic decisions in the existing pure logic modules and make `index.html` consume those decisions. Treat accepted generated placements as output unless explicitly pinned, tokenize prerequisite operators structurally, derive the current builder term from the saved academic position, and update wishlist controls in place.

**Tech Stack:** Browser JavaScript, Node's built-in test runner, Cloudflare Worker/D1 public requirement data.

## Global Constraints

- Execute sequentially without subagents.
- Use test-driven development for every production change.
- Do not modify `main` or production.
- Do not make paid OpenAI requests.
- Preserve `33:136:385 Statistical Methods in Business` as a distinct required course.
- Preserve the reviewed Finance minimum of four electives.
- Avoid broad refactoring of `index.html`.

---

### Task 1: Regeneration input invariant

**Files:**
- Modify: `planner-input-logic.js`
- Test: `worker/tests/planner-input-logic.test.mjs`

**Interfaces:**
- Consumes: schedule entries with `userPinned` and `locked`.
- Produces: `buildPlannerInput(input)` that excludes obsolete unlocked generated placements while retaining explicit pins.

- [ ] **Step 1: Write the failing regeneration regression**

Add a test whose requirement tree contains canonical `01:198:170` with
alternative `01:198:111`, and whose existing schedule contains both courses as
`userPinned: false, locked: false`. Assert that planner input contains
`01:198:111` and excludes `01:198:170`.

Add a second assertion with `01:198:170` explicitly pinned and assert that the
pinned placement remains available through `lockedPlacements`.

- [ ] **Step 2: Verify the test fails**

Run:

```bash
node --test worker/tests/planner-input-logic.test.mjs
```

Expected: the unlocked regeneration case still contains `01:198:170`.

- [ ] **Step 3: Implement the input invariant**

Restrict the schedule-entry preservation pass in `buildPlannerInput` to
explicitly pinned entries. Generated entries must be rebuilt from requirement
trees, selections, completed credit, and wishlist inputs.

- [ ] **Step 4: Verify the focused test passes**

Run:

```bash
node --test worker/tests/planner-input-logic.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add planner-input-logic.js worker/tests/planner-input-logic.test.mjs
git commit -m "Fix planner regeneration input state"
```

### Task 2: Title-safe prerequisite parsing

**Files:**
- Modify: `eligibility-logic.js`
- Test: `worker/tests/eligibility-logic.test.mjs`
- Test: `worker/tests/planner-input-logic.test.mjs`

**Interfaces:**
- Consumes: Rutgers catalog prerequisite prose.
- Produces: `parseCatalogPrerequisitePaths(rawText)` paths whose `and`/`or` operators are recognized only before a course code or parenthesized expression.

- [ ] **Step 1: Write the failing parser regression**

Use the exact live prerequisite string for `01:220:485`, including both titles
containing the word "and". Assert these two literal paths:

```js
[
  ["01:220:320", "01:220:321", "01:220:322", "01:640:136"],
  ["01:220:320", "01:220:321", "01:220:322", "01:640:152"],
]
```

- [ ] **Step 2: Verify the parser test fails**

Run:

```bash
node --test worker/tests/eligibility-logic.test.mjs
```

Expected: `reviewable` is false and `paths` is empty.

- [ ] **Step 3: Implement structural operator tokenization**

Change `prerequisiteExpressionTokens` so `and` and `or` become tokens only when
the following meaningful text starts `(` or a Rutgers course code. Preserve
the existing permission, GPA, standing, grade, placement, and credit fail-safe.

- [ ] **Step 4: Verify parser and planner normalization**

Add a planner-input assertion that the normalized Advanced Microeconomic Theory
course exposes both prerequisite paths, then run:

```bash
node --test worker/tests/eligibility-logic.test.mjs worker/tests/planner-input-logic.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add eligibility-logic.js worker/tests/eligibility-logic.test.mjs worker/tests/planner-input-logic.test.mjs
git commit -m "Parse Rutgers prerequisite titles safely"
```

### Task 3: Current semester builder invariant

**Files:**
- Modify: `planner-ui-logic.js`
- Modify: `index.html`
- Test: `worker/tests/planner-ui-logic.test.mjs`
- Test: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Produces: `activePlannerTerm({ academicPosition, activeSemester })` returning `{ year, semester }`.
- Consumes: `ST.academicPosition` and `activeRegistrationSemester()` in semester-builder availability and schedule-assistant term state.

- [ ] **Step 1: Write the failing stale-anchor regression**

Assert:

```js
logic.activePlannerTerm({
  academicPosition: { year: 1, startingSemester: "fall" },
  activeSemester: "fall",
})
```

returns `{ year: 1, semester: "fall" }`. Use that result with
`canOpenSemesterBuilder` to assert only first-year Fall is available.

- [ ] **Step 2: Verify the test fails**

Run:

```bash
node --test worker/tests/planner-ui-logic.test.mjs
```

Expected: `activePlannerTerm` is undefined.

- [ ] **Step 3: Implement and consume the invariant**

Add `activePlannerTerm` to `planner-ui-logic.js`. In `index.html`, use its year
and semester for:

- semester `+` visibility;
- opening the builder;
- schedule-assistant preference term keys.

Do not use `academicCalendarStartYear` for these availability decisions.

- [ ] **Step 4: Verify UI tests**

Run:

```bash
node --test worker/tests/planner-ui-logic.test.mjs worker/tests/hackathon-ui-integration.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add planner-ui-logic.js index.html worker/tests/planner-ui-logic.test.mjs worker/tests/hackathon-ui-integration.test.mjs
git commit -m "Keep the current semester builder available"
```

### Task 4: Stable wishlist toggle

**Files:**
- Modify: `planner-ui-logic.js`
- Modify: `index.html`
- Test: `worker/tests/planner-ui-logic.test.mjs`

**Interfaces:**
- Produces: `catalogWishlistAction({ inWishlist })` with enabled add/remove copy.
- Consumes: the helper in `courseRowHtml` and the Courses-page click handler.

- [ ] **Step 1: Write the failing action regression**

Assert that an unsaved course returns `{ label: "+ Wishlist", remove: false }`
and a saved course returns `{ label: "Remove", remove: true }`, with neither
state disabled.

- [ ] **Step 2: Verify the test fails**

Run:

```bash
node --test worker/tests/planner-ui-logic.test.mjs
```

- [ ] **Step 3: Implement in-place toggling**

Render the saved-state button as enabled. On click:

- add or delete `ST.wishlist[code]`;
- persist planner state;
- update only the clicked button's text and state;
- do not call `renderCoursesPage()`.

- [ ] **Step 4: Verify focused tests**

Run:

```bash
node --test worker/tests/planner-ui-logic.test.mjs worker/tests/hackathon-ui-integration.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add planner-ui-logic.js index.html worker/tests/planner-ui-logic.test.mjs worker/tests/hackathon-ui-integration.test.mjs
git commit -m "Keep catalog wishlist actions in place"
```

### Task 5: Requirement-count characterization and complete verification

**Files:**
- Test: `worker/tests/planner-ui-logic.test.mjs`

**Interfaces:**
- Consumes: `requirementProgressCourseIds({ appliedIds, selectedIds })`.
- Produces: permanent coverage for one scheduled plus two selected Finance electives equaling three distinct choices.

- [ ] **Step 1: Add the Finance characterization**

Assert that one applied ID plus two selected IDs produces exactly three unique
IDs. Do not change the reviewed requirement count.

- [ ] **Step 2: Run focused tests**

```bash
node --test worker/tests/academic-credit-logic.test.mjs worker/tests/eligibility-logic.test.mjs worker/tests/planner-input-logic.test.mjs worker/tests/planner-ui-logic.test.mjs worker/tests/hackathon-ui-integration.test.mjs
```

- [ ] **Step 3: Run the full suite**

```bash
node --test worker/tests/*.test.mjs
```

- [ ] **Step 4: Perform browser smoke tests**

Verify on a fresh local origin:

- adding and removing a catalog wishlist course keeps the viewport stable;
- first-year Fall shows `+`;
- first-year Spring and other years do not show `+`;
- generated planner input does not contain both Intro CS and Comp Apps;
- Advanced Microeconomics appears after its selected prerequisite path.

- [ ] **Step 5: Commit, push, and update dev**

Commit any final test-only change, push `codex/systemic-planner-fixes`, and
fast-forward `dev` only after the exact pushed tree passes verification.
