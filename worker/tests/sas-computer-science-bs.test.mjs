import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Computer Science BS contract preserves core, elective, and laboratory-science paths", () => {
  const id = "sasnb-computer-science-bs";
  const definition = programDefinition(id);
  const codes = new Set(courseCodes(id));
  for (const code of [
    "01:198:111", "01:198:112", "01:198:205", "01:198:206", "01:198:211", "01:198:344",
    "01:640:151", "01:640:152", "01:640:250", "01:750:203", "01:750:204",
    "01:750:123", "01:750:124", "01:750:271", "01:750:272", "01:750:201",
    "01:750:202", "01:750:193", "01:750:194", "01:160:159", "01:160:160",
    "01:160:161", "01:160:162", "01:160:163", "01:160:164",
  ]) assert.ok(codes.has(code), `missing ${code}`);
  assert.equal(definition.program.academic_program_code, "198S");
  assert.equal(requirementGroup(id, `${id}-science-sequence`).rule, "one_of");
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-electives`).count,
      requirementGroup(id, `${id}-cs-electives`).count,
      requirementGroup(id, `${id}-upper-cs-electives`).count,
      requirementGroup(id, `${id}-independent-study`).count,
    ],
    [7, 5, 2, 1],
  );
  assert.match(JSON.stringify(definition), /last 10 years/);
});
