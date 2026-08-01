import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Political Science minor contract preserves total and upper-level boundaries", () => {
  const id = "sasnb-political-science-minor";
  assert.deepEqual(
    [requirementGroup(id, `${id}-total`).count, requirementGroup(id, `${id}-upper`).count],
    [6, 4],
  );
  const selector = requirementGroup(id, `${id}-upper`).selectors[0].selector;
  assert.deepEqual(
    [selector.course_number_min, selector.exclude_course_codes],
    [300, ["01:790:395"]],
  );
});

test("the Government and Business minor contract preserves core, electives, and exclusion policy", () => {
  const id = "sasnb-government-business-minor";
  assert.deepEqual(courseCodes(id), ["01:790:101", "01:790:338"]);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-electives`).count,
      requirementGroup(id, `${id}-upper-electives`).count,
    ],
    [4, 3],
  );
  const serialized = JSON.stringify(programDefinition(id));
  for (const code of ["01:790:102", "01:790:362", "01:790:488"]) assert.match(serialized, new RegExp(code));
  assert.ok(programDefinition(id).eligibility_rules.some(({ key }) => key === `${id}-no-political-science`));
});

test("the History minor contract preserves all subject codes and its upper-level threshold", () => {
  const id = "sasnb-history-minor";
  assert.deepEqual(
    [requirementGroup(id, `${id}-total`).count, requirementGroup(id, `${id}-upper`).count],
    [6, 3],
  );
  const selector = requirementGroup(id, `${id}-upper`).selectors[0].selector;
  assert.deepEqual([selector.subject_codes, selector.course_number_min], [["506", "508", "510", "512"], 300]);
});
