import assert from "node:assert/strict";
import test from "node:test";
import {
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Statistics minor snapshot preserves required, additional, and advanced subsets", () => {
  const id = "sasnb-statistics-minor";
  const program = programDefinition(id);
  assert.equal(program.program.program_family_id, "sasnb-statistics-960");
  assert.equal(requirementGroup(id, `${id}-required`).count, 1);
  assert.equal(requirementGroup(id, `${id}-additional`).count, 6);
  assert.equal(requirementGroup(id, `${id}-advanced`).count, 3);
  const serialized = JSON.stringify(program.requirement_groups);
  ["01:960:295", "01:960:390", "01:198:142", "01:640:477", "01:640:481", "01:960:365", "01:960:490"]
    .forEach((code) => assert.match(serialized, new RegExp(code)));
  const statisticsSelector = requirementGroup(id, `${id}-additional`)
    .selectors.find(({ selector }) => selector.kind === "subject_level").selector;
  assert.deepEqual(
    statisticsSelector.exclude_course_codes,
    ["01:960:295", "01:960:390"],
  );
});
