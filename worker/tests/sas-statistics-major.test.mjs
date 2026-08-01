import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Statistics major snapshot retains core, alternatives, and elective boundaries", () => {
  const program = programDefinition("sasnb-statistics-major");
  assert.equal(program.program.program_family_id, "sasnb-statistics-960");
  const codes = new Set(courseCodes(program.program.id));
  [
    "01:198:107", "01:198:110", "01:198:111", "01:198:170",
    "01:640:151", "01:640:152", "01:640:250", "01:640:251",
    "01:640:252", "01:960:381", "01:960:382", "01:960:212",
    "01:960:384", "01:960:295", "01:960:390", "01:960:463",
    "01:960:486", "01:960:490", "01:960:365", "01:960:467",
    "01:960:476", "01:960:483",
  ].forEach((code) => assert.ok(codes.has(code), `missing ${code}`));
  const math = requirementGroup(
    program.program.id,
    "sasnb-statistics-major-mathematics-elective",
  );
  assert.deepEqual(
    math.selectors[0].selector.exclude_course_codes,
    ["01:640:477", "01:640:481"],
  );
  assert.equal(
    requirementGroup(
      program.program.id,
      "sasnb-statistics-major-statistics-electives",
    ).count,
    2,
  );
  assert.match(program.eligibility_rules[0].note, /course-grade rule/);
});
