# Prompt 2 Regression Fixes Design

**Date:** 2026-07-27
**Branch:** `codex/systemic-planner-fixes`
**Target:** development only until user approval for `main`

## Scope

Fix the three confirmed regressions in `prompt-2.pdf` without adding
course-specific browser logic:

1. Only the current registration semester exposes a working schedule-builder
   `+` button.
2. Requirement progress counts courses selected for that requirement as well as
   courses already scheduled or completed.
3. The four-year planner does not generate a canonical requirement course when
   another simultaneously required course is its reviewed equivalent.

`33:136:385` Statistical Methods in Business remains a required course. No
equivalency involving that course will be added or changed.

## Design

### Current-semester schedule builder

Keep `canOpenSemesterBuilder` as the single term decision. The rendered
`hidden` and `disabled` states continue to use that decision, and stylesheet
rules must not override the native hidden state. Clicking a visible current-term
button opens the builder; non-current buttons remain absent and guarded.

### Requirement progress

Create one pure progress-count decision that unions:

- scheduled/completed courses automatically applied to a requirement; and
- valid manual selections saved for that same requirement.

The union is de-duplicated, so a selected course that later enters the schedule
still counts once. Completion rules remain unchanged: a manual choice communicates
planning progress but does not claim that the course was completed.

### Planner equivalency closure

After collecting concrete courses from every selected requirement tree, compare
the combined future-course set against the generic reviewed equivalency graph.
If one concrete future course satisfies another canonical concrete requirement,
retain the actual equivalent course and suppress the redundant canonical course.

This uses requirement-tree data only. It must work for any future reviewed
equivalency and must not create an equivalency for Statistical Methods in Business.

## Alternatives considered

- UI-only label patches were rejected because planner inputs and progress would
  remain inconsistent.
- Course-code exceptions were rejected because every new program would require
  another patch.
- A broad `index.html` rewrite remains deferred; these fixes stay in the existing
  pure logic modules so the future migration can reuse them.

## Verification

Focused failing tests will prove:

- author CSS cannot expose a hidden semester button;
- the current-term button is the only actionable builder entry;
- selected and applied requirement courses produce de-duplicated progress; and
- simultaneously required reviewed equivalents produce one planner course.

Then run syntax checks, the complete Node test suite, a browser smoke test, and
dev-only deployment checks. Do not call the paid OpenAI API.
