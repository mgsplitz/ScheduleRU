import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

const approvedNumbers = [
  "111", "112", "205", "206", "210", "211", "213", "214", "314", "323", "324",
  "334", "336", "344", "345", "352", "411", "415", "416", "417", "419", "424",
  "425", "428", "431", "437", "439", "440", "442", "452", "460", "461", "462",
];

test("the Computer Science minor contract preserves its finite list and upper-level constraint", () => {
  const id = "sasnb-computer-science-minor";
  const codes = new Set(courseCodes(id));
  for (const number of approvedNumbers) assert.ok(codes.has(`01:198:${number}`), `missing ${number}`);
  for (const number of ["105", "107", "110", "170", "405"]) assert.equal(codes.has(`01:198:${number}`), false);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-approved-courses`).count,
      requirementGroup(id, `${id}-upper-level`).count,
    ],
    [6, 2],
  );
  assert.match(JSON.stringify(programDefinition(id)), /At least five of the courses/);
});
