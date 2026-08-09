import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";
import { webApplicationSource as frontend } from "./helpers/web-source.mjs";

const requirementTreeBuilder = await readFile(
  new URL("../../packages/requirements/src/requirement-tree-builder.js", import.meta.url),
  "utf8",
);

test("reviewed allocation conditions are returned to the browser as group allocation data", () => {
  assert.match(worker, /allocationsByGroup/);
  assert.match(worker, /allocationForConditions\(conditionsByGroup\[group\.id\]\)/);
  assert.match(worker, /max_uses: familyMaxUses\.get\(allocationsByGroup\[g\.id\]\.allocation_family\)/);
  assert.match(requirementTreeBuilder, /allocation:\s*raw\.allocation/);
});

test("the group browser applies and explains a reviewed exclusive allocation without hiding eligible alternatives", () => {
  assert.match(frontend, /allocateRequirementCourses\(GROUPS/);
  assert.match(frontend, /function allocationSummaryHtml\(g\)/);
  assert.match(frontend, /allocationSummaryHtml\(g\)/);
  assert.match(frontend, /\(g\.members\|\|\[\]\)\.filter\(id=>!applied\.includes\(id\)\)/);
});
