# Task 1 — Reusable credit-count groups report

## Files changed

- `requirement-group-logic.js`
  - Added `groupProgress`, which returns the unique applied-course count and summed credits.
  - Added `min_credits` and `max_credits` evaluation while retaining the prior course-count path for `min` and `max` groups.
- `index.html`
  - Preserves reviewed `min_credits` and `max_credits` rules during requirement-tree normalization.
  - Supplies course credits to the shared evaluator and renders credit-rule progress as both course count and credits.
- `worker/tests/requirement-group-logic.test.mjs`
  - Added differing-credit and partially-completed max-credit constraint coverage.
- `worker/tests/course-selector-integration.test.mjs`
  - Confirms the Worker continues returning the raw reviewed group rule and the browser preserves/renders credit rules.

`worker/src/programs.js` already returns requirement-group rows through `SELECT * FROM requirement_groups`; no production Worker change was needed to carry the reviewed rule and count fields. The integration test locks that contract down.

## TDD RED

Command:

```sh
node --test worker/tests/requirement-group-logic.test.mjs
```

Output: 6 passing, 2 failing. The new minimum-credit test failed with `TypeError: groupProgress is not a function`, and the maximum-credit constraint failed because the pre-change evaluator treated it as a course-count maximum (`true !== false`). This was expected because neither credit progress nor credit-rule evaluation existed.

The UI/normalization RED command was:

```sh
node --test worker/tests/course-selector-integration.test.mjs
```

Output: 2 passing, 1 failing. The new assertion could not find `min_credits` normalization in `index.html`, as expected before the browser change.

After independent review, the focused UI test was extended to require that credit groups bypass the course-count picker. It again failed 2 passing, 1 failing because `isPickerGroup` still accepted credit rules; the implementation then excluded those rules so users are not told to choose a number of courses for a credit requirement.

## GREEN

Command:

```sh
node --test worker/tests/requirement-group-logic.test.mjs worker/tests/course-selector-integration.test.mjs
```

Output: 11 passing, 0 failing.

## Full suite

Commands:

```sh
node --check <(sed -n '/^<script>$/,/^<\\/script>$/p' index.html | sed '1d;$d')
node --test worker/tests/*.test.mjs
```

Output: browser inline JavaScript syntax check exited 0; full suite: 61 passing, 0 failing. Existing RBS requirement display/allocation tests remained green.

## Commit

Implementation commit: `6ec5270e5db5e56a4e6180df9bf29f10120a9e86` (`Support credit-count requirement groups`).

## Self-review

- Credit totals use the same de-duplicated applied-course set as course-count completion, so a course cannot add credits twice within one group.
- Invalid/missing credit values contribute zero rather than making a group complete.
- Existing `min`/`max` course rules retain their original count semantics; existing RBS tests pass unchanged.
- The UI is generic: it recognizes rule types, not a school/program identifier, and supports nested reviewed credit constraints.
- Independent review caught and the follow-up test fixed a misleading course-count picker path for large credit groups. Credit groups now remain in the automatic scheduled/completed application flow.
- Scope is limited to rule evaluation, normalization, progress display, and focused tests; no SAS data, source content, deployment, or unrelated files were changed. The pre-existing `.gitignore` modification was left untouched.

## Concerns

None. This is generic infrastructure only; reviewed program data and any source-backed SAS rule entry remain separate future work.
