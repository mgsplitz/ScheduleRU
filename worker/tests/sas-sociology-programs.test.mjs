import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Sociology major contract preserves core and elective thresholds", () => {
  const id = "sasnb-sociology-ba";
  assert.deepEqual(courseCodes(id), [
    "01:920:101", "01:920:215", "01:920:311", "01:920:312", "01:920:316",
  ]);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-electives`).count,
      requirementGroup(id, `${id}-upper-electives`).count,
    ],
    [6, 3],
  );
  const selector = requirementGroup(id, `${id}-upper-electives`).selectors[0].selector;
  assert.deepEqual([selector.subject_codes, selector.course_number_min], [["920"], 300]);
  assert.match(programDefinition(id).eligibility_rules[0].note, /Rutgers-New Brunswick/);
});

test("the Sociology minor contract preserves its core choice and nested elective levels", () => {
  const id = "sasnb-sociology-minor";
  const definition = programDefinition(id);
  assert.deepEqual(courseCodes(id), ["01:920:101", "01:920:311", "01:920:312", "01:920:316"]);
  assert.equal(requirementGroup(id, `${id}-method-or-theory`).rule, "one_of");
  assert.equal(requirementGroup(id, `${id}-electives`).count, 4);
  assert.deepEqual(
    ["electives-200", "electives-300", "electives-315"].map(
      (suffix) => requirementGroup(id, `${id}-${suffix}`).selectors[0].selector.course_number_min,
    ),
    [200, 300, 315],
  );
  assert.ok(
    definition.eligibility_rules.some(
      ({ key }) => key === "sasnb-criminal-justice-major-sociology-minor-criminology-exclusion",
    ),
  );
});
