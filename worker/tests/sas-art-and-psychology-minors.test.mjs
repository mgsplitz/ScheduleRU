import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Art History minor contract preserves its introduction and upper-level structure", () => {
  const id = "sasnb-art-history-minor";
  const definition = programDefinition(id);
  assert.equal(definition.program.program_family_id, "sasnb-art-history-082");
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-introductions`).count,
      requirementGroup(id, `${id}-upper-level`).count,
    ],
    [2, 4],
  );
  assert.deepEqual(
    requirementGroup(id, `${id}-introductions`).selectors[0].selector.include_course_codes,
    ["01:082:105", "01:082:106", "01:082:107"],
  );
  assert.equal(
    requirementGroup(id, `${id}-upper-level`).selectors[0].selector.course_number_min,
    200,
  );
  assert.ok(definition.requirement_groups.every(({ evidence }) => evidence?.review_status === "reviewed"));
});

test("the Psychology minor contract preserves its fixed introduction and 200-level limit", () => {
  const id = "sasnb-psychology-minor";
  assert.deepEqual(courseCodes(id), ["01:830:101"]);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-electives`).count,
      requirementGroup(id, `${id}-200-limit`).count,
    ],
    [5, 2],
  );
  assert.ok(
    programDefinition(id).eligibility_rules.some(
      ({ key }) => key === "sasnb-psychology-minor-no-developmental-psychology",
    ),
  );
});

test("the Developmental Psychology minor contract preserves core, electives, and fieldwork cap", () => {
  const id = "sasnb-developmental-psychology-minor";
  assert.equal(programDefinition(id).program.program_family_id, "sasnb-developmental-psychology-835");
  assert.deepEqual(courseCodes(id), ["01:830:101", "01:830:271"]);
  assert.equal(requirementGroup(id, `${id}-electives`).count, 4);
  assert.equal(requirementGroup(id, `${id}-fieldwork-limit`).count, 1);
  const selectors = JSON.stringify(programDefinition(id).requirement_groups);
  for (const code of ["01:830:331", "01:830:484"]) assert.match(selectors, new RegExp(code));
  assert.ok(
    programDefinition(id).eligibility_rules.some(
      ({ key }) => key === "sasnb-developmental-psychology-minor-no-psychology",
    ),
  );
});
