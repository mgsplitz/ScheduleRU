import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Mathematics snapshot separates the published B.A. and Honors B.S. paths", () => {
  const ba = programDefinition("sasnb-mathematics-ba");
  const honors = programDefinition("sasnb-mathematics-honors-bs");
  assert.equal(ba.program.degree_type, "B.A.");
  assert.equal(honors.program.degree_type, "B.S.");
  assert.equal(ba.program.program_family_id, "sasnb-mathematics-640");
  assert.equal(honors.program.program_family_id, "sasnb-mathematics-640");
  const expected = [
    "01:640:151", "01:640:152", "01:640:251", "01:640:250",
    "01:640:252", "01:640:300", "01:640:311", "01:640:312",
    "01:640:350", "01:640:351", "01:640:411", "01:640:412",
    "01:640:451", "01:640:452", "01:640:291", "01:640:292",
    "01:640:196", "01:640:491", "01:640:492",
  ];
  const codes = new Set([...courseCodes(ba.program.id), ...courseCodes(honors.program.id)]);
  expected.forEach((code) => assert.ok(codes.has(code), `missing ${code}`));
  const selector = requirementGroup(
    ba.program.id,
    "sasnb-mathematics-ba-upper-level-total",
  ).selectors[0].selector;
  assert.deepEqual(
    [selector.course_number_min, selector.course_number_max, selector.minimum_credits],
    [300, 499, 3],
  );
  assert.match(honors.eligibility_rules[0].note, /Honors admission/);
});
