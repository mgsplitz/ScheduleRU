import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Physics General Option contract preserves core, labs, and upper-level selector", () => {
  const id = "sasnb-physics-general-ba";
  const definition = programDefinition(id);
  assert.deepEqual(
    [definition.program.name, definition.program.academic_program_code, definition.program.degree_type],
    ["Physics - General Option", "750", "B.A."],
  );
  const codes = new Set(courseCodes(id));
  for (const code of [
    "01:750:203", "01:750:204", "01:750:205", "01:750:206", "01:750:229",
    "01:750:230", "01:750:275", "01:750:276", "01:750:313", "01:750:323",
    "01:750:324", "01:750:326", "01:750:327", "01:750:345", "01:750:346",
  ]) assert.ok(codes.has(code), `missing ${code}`);
  assert.equal(requirementGroup(id, `${id}-laboratories`).rule, "one_of");
  assert.equal(requirementGroup(id, `${id}-advanced-labs`).rule, "one_of");
  const selector = requirementGroup(id, `${id}-additional-advanced`).selectors[0].selector;
  assert.deepEqual(
    [selector.subject_codes, selector.course_number_min, selector.course_number_max],
    [["750"], 300, 489],
  );
  assert.match(JSON.stringify(definition), /C average/);
});
