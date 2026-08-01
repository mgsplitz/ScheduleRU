import assert from "node:assert/strict";
import test from "node:test";

import {
  allProgramDefinitions,
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("loads every canonical reviewed definition exactly once", () => {
  const definitions = allProgramDefinitions();
  assert.equal(definitions.length, 49);
  assert.equal(
    new Set(definitions.map(({ program }) => program.id)).size,
    definitions.length,
  );
});

test("returns programs, groups, and flattened course codes by stable ID", () => {
  const program = programDefinition("sasnb-statistics-major");
  assert.equal(program.program.type, "major");
  assert.equal(
    requirementGroup(
      "sasnb-statistics-major",
      "sasnb-statistics-major-statistics-core",
    ).name,
    "Required Statistics courses.",
  );
  assert.ok(courseCodes("sasnb-statistics-major").includes("01:960:381"));
});

test("fails loudly for missing programs and groups", () => {
  assert.throws(() => programDefinition("missing-program"), /missing program/);
  assert.throws(
    () => requirementGroup("sasnb-statistics-major", "missing-group"),
    /missing requirement group/,
  );
});
