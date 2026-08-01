import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Mathematics minor snapshot records the published SAS requirements", () => {
  const program = programDefinition("sasnb-mathematics-minor");
  assert.equal(program.program.program_family_id, "sasnb-mathematics-640");
  const codes = new Set(courseCodes(program.program.id));
  ["01:640:151", "01:640:152", "01:640:251", "01:640:250", "01:640:244", "01:640:252"]
    .forEach((code) => assert.ok(codes.has(code), `missing ${code}`));
  const electives = requirementGroup(
    program.program.id,
    "sasnb-mathematics-minor-electives",
  );
  assert.equal(electives.rule, "min_courses");
  assert.equal(electives.count, 4);
  assert.deepEqual(
    electives.selectors[0].selector.exclude_course_codes,
    ["01:640:491", "01:640:492"],
  );
  assert.match(program.eligibility_rules[0].note, /elective-residency/);
});
