import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Computer Science BA contract preserves core and designated elective constraints", () => {
  const id = "sasnb-computer-science-ba";
  const definition = programDefinition(id);
  const codes = new Set(courseCodes(id));
  for (const code of [
    "01:198:111", "01:198:112", "01:198:205", "01:198:206", "01:198:211", "01:198:344",
    "01:640:151", "01:640:152", "01:640:250", "01:198:210", "01:198:213", "01:198:314",
    "01:198:493", "01:198:494", "14:332:376", "14:332:472", "01:640:338",
    "01:730:315", "01:615:441", "01:960:486",
  ]) assert.ok(codes.has(code), `missing ${code}`);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-electives`).count,
      requirementGroup(id, `${id}-cs-electives`).count,
      requirementGroup(id, `${id}-upper-cs-electives`).count,
      requirementGroup(id, `${id}-independent-study`).count,
    ],
    [5, 3, 2, 1],
  );
  assert.match(JSON.stringify(definition), /last 10 years/);
});
