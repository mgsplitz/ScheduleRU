import assert from "node:assert/strict";
import test from "node:test";
import { programDefinition, requirementGroup } from "./helpers/catalog-snapshot.mjs";

const cases = [
  {
    id: "sasnb-classical-humanities-minor",
    family: "sasnb-classical-humanities-190",
    subjects: ["190", "490", "580"],
    total: 7,
  },
  {
    id: "sasnb-latin-minor",
    family: "sasnb-latin-580",
    subjects: ["580"],
    total: 6,
  },
  {
    id: "sasnb-ancient-greek-minor",
    family: "sasnb-ancient-greek-491",
    subjects: ["490"],
    total: 6,
  },
];

for (const { id, family, subjects, total } of cases) {
  test(`${id} preserves its reviewed total and upper-level contract`, () => {
    const definition = programDefinition(id);
    assert.equal(definition.program.program_family_id, family);
    assert.deepEqual(
      [
        requirementGroup(id, `${id}-total`).count,
        requirementGroup(id, `${id}-upper-level`).count,
      ],
      [total, 3],
    );
    assert.deepEqual(
      requirementGroup(id, `${id}-total`).selectors[0].selector.subject_codes,
      subjects,
    );
    assert.ok(definition.requirement_groups.every(({ evidence }) => evidence?.review_status === "reviewed"));
  });
}
