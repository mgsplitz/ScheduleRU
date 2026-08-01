import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Philosophy BA snapshot retains core areas and whole-major thresholds", () => {
  const id = "sasnb-philosophy-major";
  const program = programDefinition(id);
  assert.equal(program.program.program_family_id, "sasnb-philosophy-730");
  const codes = new Set(courseCodes(id));
  [
    "01:730:109", "01:730:201", "01:730:315", "01:730:407",
    "01:730:408", "01:730:301", "01:730:302", "01:730:304",
    "01:190:322", "01:730:352", "01:190:353", "01:730:307",
    "01:730:308", "01:730:404", "01:730:416", "01:730:330",
    "01:730:341", "01:730:441", "01:730:470", "01:730:210",
    "01:730:225", "01:730:420", "01:730:435",
  ].forEach((code) => assert.ok(codes.has(code), `missing ${code}`));
  assert.equal(requirementGroup(id, `${id}-total`).count, 11);
  assert.equal(requirementGroup(id, `${id}-upper-level`).count, 6);
  assert.equal(requirementGroup(id, `${id}-theory`).count, 2);
  const selector = requirementGroup(id, `${id}-200-level`).selectors[0].selector;
  assert.equal(selector.minimum_credits, 3);
  assert.deepEqual(
    selector.exclude_course_codes,
    ["01:730:201", "01:730:202", "01:730:295", "01:730:296"],
  );
});
