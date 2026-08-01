import assert from "node:assert/strict";
import test from "node:test";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";
import { programCombinationPolicy } from "./helpers/reference-data-snapshot.mjs";

test("the Criminology minor contract preserves its core and independent elective boundaries", () => {
  const id = "sasnb-criminology-minor";
  const definition = programDefinition(id);
  assert.equal(definition.program.program_family_id, "sasnb-criminology-204");
  assert.equal(requirementGroup(id, `${id}-core`).rule, "all");
  assert.equal(requirementGroup(id, `${id}-sociology-elective`).count, 1);
  assert.equal(requirementGroup(id, `${id}-criminal-justice-elective`).count, 1);
  const serialized = JSON.stringify(definition);
  for (const code of [
    "01:202:201", "01:830:101", "01:830:340", "01:920:101",
    "01:920:222", "01:920:306", "01:920:304", "01:920:307", "01:920:349",
  ]) assert.match(serialized, new RegExp(code));
  assert.ok(courseCodes(id).includes("01:202:201"));
  assert.equal(
    programCombinationPolicy("sasnb-criminal-justice-major-no-criminology-minor").decision,
    "blocked",
  );
  assert.ok(definition.sources.some(({ url }) => /Criminology_Minor_Requirement_form1\.pdf/.test(url)));
});
