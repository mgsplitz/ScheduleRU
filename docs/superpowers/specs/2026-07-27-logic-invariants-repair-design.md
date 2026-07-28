# Logic Invariants Repair Design

## Goal

Repair the four confirmed logic regressions from the July 27 PDF without
rewriting the application or adding course-specific frontend exceptions.

The repaired behavior must survive the complete local-state lifecycle:
generate a plan, accept it, edit it, regenerate it, reload the browser, and
re-evaluate requirements.

## Scope and constraints

- Work sequentially without subagents.
- Update the development branch only. Do not modify `main` or production.
- Do not make paid OpenAI requests during testing.
- Preserve local-browser storage and existing accepted plans.
- Continue treating `33:136:385 Statistical Methods in Business` as a required
  course. It is not an equivalency.
- Do not change the reviewed Finance requirement of four electives. The PDF's
  `3/4` state is correct: one scheduled course plus two selected courses equals
  three of four.
- Avoid an architectural migration in this repair. The future migration out of
  the monolithic `index.html` remains separate work.

## Root causes

### Regeneration re-imports obsolete generated placements

`planner-input-logic.js` correctly closes reviewed equivalencies while
collecting requirements. A later schedule-entry pass then adds every existing
placement that matches any requirement-tree course, including unlocked courses
from a previously generated plan. If both `01:198:111` and `01:198:170` already
exist in that plan, both are reintroduced after the equivalency filter.

### Catalog prerequisite titles corrupt expression parsing

`eligibility-logic.js` currently tokenizes every standalone `and` or `or`.
Rutgers course titles such as "Calculus II for the Life and Social Sciences"
therefore produce false logical operators. The parser rejects the otherwise
structured prerequisite expression for `01:220:485`, leaving the planner with
no enforceable prerequisite paths.

### The current-semester control depends on a stale calendar anchor

The semester `+` visibility compares the displayed plan year with a value
calculated from the persisted `academicCalendarStartYear`. A saved anchor from
2025 combined with the 2026 development configuration classifies displayed
first year as active second year, hiding the Fall button. The user's
`academicPosition` is the authoritative current plan year for this local
planning workflow.

### Wishlist actions rebuild the catalog

The Courses page disables the wishlist button once a course is saved. Adding a
course then calls `renderCoursesPage()`, replacing the entire course-list DOM
and moving the viewport. The same row should support both adding and removing
without a full-page render.

## Design

### Planner input invariant

Regeneration will preserve only schedule entries explicitly marked
`userPinned` or `locked`. Unlocked entries are generated output, not new input.
Requirements, group selections, completed credit, reviewed equivalencies, and
wishlist choices remain the sources for a new generated plan.

This makes regeneration idempotent: feeding an accepted generated plan back
into the planner cannot create extra courses. Explicit user placements remain
untouched even when the planner would choose differently.

### Prerequisite parsing invariant

The catalog parser will recognize `and` and `or` as operators only when the
next meaningful token begins a course code or parenthesized expression. Words
inside course titles will remain ignored. Existing fail-closed phrases such as
permission, GPA, standing, placement, and grade rules will remain unresolved.

The exact live `01:220:485` catalog expression must produce two valid paths:

1. `01:220:320`, `01:220:321`, `01:220:322`, `01:640:136`
2. `01:220:320`, `01:220:321`, `01:220:322`, `01:640:152`

The four-year planner will then place the selected path before Advanced
Microeconomic Theory through its existing prerequisite scheduler.

### Current-term invariant

The schedule-builder control will use:

- plan year: `ST.academicPosition.year`
- semester: the development API's active Fall/Spring term

The persisted calendar anchor can continue supporting calendar labels, but it
will not decide whether the current-semester builder is available. Only the
matching current plan-year semester will show `+`.

### Wishlist invariant

The Courses page wishlist button will remain enabled:

- unsaved course: `+ Wishlist`
- saved course: `Remove`

The click handler will toggle the record in `ST.wishlist`, persist state, and
update the clicked row in place. It will not replace the Courses page DOM, so
scroll position, expanded rows, search focus, and loaded sections remain
stable. The existing remove control in the Wishlist panel remains available.

### Requirement-progress invariant

Requirement progress is the de-duplicated union of scheduled/completed members
and saved requirement selections. Wishlist-only courses do not count.

The existing Finance example remains `3/4` until a fourth distinct approved
elective is scheduled or selected. No requirement count or reviewed data will
be changed for that screenshot.

## Testing

Each defect will follow a red-green test cycle:

1. Regeneration with unlocked `01:198:111` and `01:198:170` must retain only
   `01:198:111`; a pinned placement must remain preserved.
2. The exact live Advanced Microeconomics prerequisite string must parse into
   the two expected paths, and planner generation must place prerequisites
   earlier.
3. A stale calendar anchor must not hide the Fall builder for the saved current
   academic year; every other semester remains unavailable.
4. The Courses page contract must expose an enabled removal action and must not
   call a full catalog render from the wishlist toggle.
5. One scheduled Finance elective plus two selected Finance electives must
   remain three distinct courses, documenting the correct `3/4` behavior.

After focused tests pass, run the entire Node test suite and perform a browser
smoke test of wishlist scroll stability and current-semester button behavior.

## Delivery

Commit the repair on `codex/systemic-planner-fixes`, push that branch, and
fast-forward `dev` only after all verification passes. Preserve the worktree
for follow-up testing.
