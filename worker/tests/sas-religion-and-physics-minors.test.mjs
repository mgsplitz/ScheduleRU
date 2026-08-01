import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Religion minor contract preserves six total and three upper-level courses", () => {
  const id = "sasnb-religion-minor";
  assert.equal(programDefinition(id).program.program_family_id, "sasnb-religion-840");
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-total`).count,
      requirementGroup(id, `${id}-upper-level`).count,
    ],
    [6, 3],
  );
  const selector = requirementGroup(id, `${id}-upper-level`).selectors[0].selector;
  assert.deepEqual([selector.subject_codes, selector.course_number_min, selector.minimum_credits], [["840"], 300, 3]);
});

test("the Physics minor contract preserves sequence choices and 12 advanced credits", () => {
  const id = "sasnb-physics-minor";
  for (const code of [
    "01:750:203", "01:750:204", "01:750:205", "01:750:206",
    "01:750:229", "01:750:230", "01:750:275", "01:750:276",
  ]) assert.ok(courseCodes(id).includes(code), `missing ${code}`);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-advanced`).rule,
      requirementGroup(id, `${id}-advanced`).count,
    ],
    ["min_credits", 12],
  );
  assert.equal(
    requirementGroup(id, `${id}-advanced`).selectors[0].selector.course_number_min,
    300,
  );
});

test("the Astronomy minor contract preserves advanced options and Astrophysics exclusion", () => {
  const id = "sasnb-astronomy-minor";
  const definition = programDefinition(id);
  assert.equal(definition.program.program_family_id, "sasnb-astronomy-100");
  const advanced = requirementGroup(id, `${id}-advanced`);
  assert.equal(advanced.count, 2);
  for (const code of ["01:750:345", "01:750:346", "01:750:441", "01:750:442", "01:750:443", "01:750:444"]) {
    assert.ok(advanced.selectors[0].selector.include_course_codes.includes(code), `missing ${code}`);
  }
  assert.ok(definition.eligibility_rules.some(({ key }) => key === "sasnb-astronomy-minor-no-astrophysics"));
});
