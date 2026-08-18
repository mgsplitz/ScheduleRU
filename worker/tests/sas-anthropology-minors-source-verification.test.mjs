import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateProgramDefinition } from "../../packages/catalog/src/index.ts";

const cases = [
  {
    file: "sasnb-anthropology-general-minor.v1.json",
    id: "sasnb-anthropology-general-minor",
    credits: 19,
    groups: [
      "sasnb-anthropology-general-total",
      "sasnb-anthropology-general-cultural-intro",
      "sasnb-anthropology-general-evolutionary-intro",
      "sasnb-anthropology-general-upper-level",
    ],
  },
  {
    file: "sasnb-anthropology-cultural-minor.v1.json",
    id: "sasnb-anthropology-cultural-minor",
    credits: 18,
    groups: [
      "sasnb-anthropology-cultural-total",
      "sasnb-anthropology-cultural-intro",
      "sasnb-anthropology-cultural-geographic",
      "sasnb-anthropology-cultural-upper-level",
    ],
  },
  {
    file: "sasnb-anthropology-evolutionary-minor.v1.json",
    id: "sasnb-anthropology-evolutionary-minor",
    credits: 20,
    groups: [
      "sasnb-anthropology-evolutionary-total",
      "sasnb-anthropology-evolutionary-fixed-intro",
      "sasnb-anthropology-evolutionary-choice-intro",
      "sasnb-anthropology-evolutionary-electives",
      "sasnb-anthropology-evolutionary-upper-level",
    ],
  },
];

for (const expected of cases) {
  test(`${expected.id} preserves the reconciled current department total`, async () => {
    const definition = JSON.parse(await readFile(
      new URL(`../../catalog/drafts/${expected.file}`, import.meta.url),
      "utf8",
    ));

    assert.equal(validateProgramDefinition(definition).ok, true);
    assert.deepEqual(
      [definition.program.id, definition.program.review_status],
      [expected.id, "unreviewed"],
    );
    assert.equal(
      definition.sources[0].url,
      `https://anthro.rutgers.edu/academics/undergraduate/undergraduate-minors/${
        expected.id.endsWith("general-minor") ? "947-minor-in-anthropology"
          : expected.id.endsWith("cultural-minor") ? "948-minor-in-cultural-anthropology"
            : "949-minor-in-evolutionary-anthropology"
      }`,
    );
    assert.deepEqual(
      definition.requirement_groups.map(({ id }) => id),
      expected.groups,
    );
    const total = definition.requirement_groups[0];
    assert.deepEqual([total.rule, total.count], ["min_credits", expected.credits]);
    const totalPool = new Set(
      total.selectors.flatMap(({ selector }) => selector.include_course_codes ?? []),
    );
    const upperLevel = definition.requirement_groups.find(
      ({ id }) => id.endsWith("upper-level"),
    );
    assert.equal(upperLevel.selectors[0].selector.kind, "course_codes");
    assert.ok(
      upperLevel.selectors[0].selector.include_course_codes.every(
        (code) => totalPool.has(code) && Number(code.slice(-3)) >= 300,
      ),
      "upper-level courses must be restricted to the minor's published pool",
    );
    assert.ok(definition.requirement_groups.every(
      ({ evidence }) => evidence?.review_status === "unreviewed",
    ));
  });
}
