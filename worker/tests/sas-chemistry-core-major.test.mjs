import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
} from "./helpers/catalog-snapshot.mjs";

test("the Chemistry Core Option contract preserves every published complete course path", () => {
  const id = "sasnb-chemistry-core-ba";
  const definition = programDefinition(id);
  assert.deepEqual(
    [definition.program.academic_program_code, definition.program.program_family_id],
    ["160", "sasnb-chemistry-160"],
  );
  const codes = new Set(courseCodes(id));
  for (const code of [
    "01:160:161", "01:160:162", "01:160:163", "01:160:164", "01:160:171", "01:160:251",
    "01:160:307", "01:160:308", "01:160:315", "01:160:316", "01:160:309", "01:160:310",
    "01:160:327", "01:160:328", "01:160:341", "01:160:342", "01:160:329", "01:160:348",
    "01:160:351", "01:160:352", "01:160:353", "01:160:491", "01:160:492",
    "01:640:151", "01:640:152", "01:640:250", "01:640:251", "01:640:252",
    "01:750:203", "01:750:204", "01:750:205", "01:750:206",
  ]) assert.ok(codes.has(code), `missing ${code}`);
  assert.equal(definition.requirement_groups.filter(({ rule }) => rule === "one_of").length, 5);
  assert.ok(definition.requirement_groups.every(({ evidence }) => evidence?.review_status === "reviewed"));
});
