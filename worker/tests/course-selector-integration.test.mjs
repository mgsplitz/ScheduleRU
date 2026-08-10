import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";
import { webApplicationSource as frontend } from "./helpers/web-source.mjs";

const schema = await readFile(new URL("../../migrations/schema_requirement_course_selectors.sql", import.meta.url), "utf8");
const catalogWorker = await readFile(
  new URL("../../apps/api/src/worker.js", import.meta.url),
  "utf8",
);
const requirementTreeBuilder = await readFile(
  new URL("../../packages/requirements/src/requirement-tree-builder.js", import.meta.url),
  "utf8",
);

test("reviewed selector rows are stored with an audited source and returned with their group", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS requirement_course_selectors/);
  assert.match(schema, /source_url TEXT NOT NULL/);
  assert.match(schema, /review_status TEXT NOT NULL/);
  assert.match(worker, /FROM requirement_course_selectors/);
  assert.match(worker, /WHERE review_status = 'reviewed'/);
  assert.match(worker, /course_selectors: selectorsByGroup/);
});

test("the browser loads selector matching and uses schedule/completed records for group application", () => {
  assert.match(
    frontend,
    /<script src="packages\/requirements\/src\/course-selector-logic\.js"><\/script>/,
  );
  assert.match(frontend, /function groupAppliedCourseIds\(g\)/);
  assert.match(frontend, /plannedOrCompletedCourseRecords\(g\?\.id\)/);
  assert.match(
    frontend,
    /<script src="packages\/requirements\/src\/requirement-progress-model\.js"><\/script>/,
  );
  assert.match(
    frontend,
    /<script src="packages\/requirements\/src\/requirement-tree-builder\.js"><\/script>/,
  );
  assert.match(requirementTreeBuilder, /courseSelectors:\s*Array\.isArray\(raw\.course_selectors\)/);
});

test("selector-backed requirements can open the catalog with their reviewed filter", () => {
  assert.match(frontend, /function openSelectorCourseBrowser\(gk\)/);
  assert.match(frontend, /data-gbrowse=/);
  assert.match(frontend, /params\.set\("selector", JSON\.stringify\(filter\.selectors\)\)/);
});

test("the catalog applies selector filters on the server before it paginates", () => {
  assert.match(catalogWorker, /function parseCourseSelectorFilter\(/);
  assert.match(catalogWorker, /url\.searchParams\.get\("selector"\)/);
  assert.match(catalogWorker, /course_number AS INTEGER/);
});

test("reviewed credit-count group rules survive normalization and render course and credit progress", () => {
  assert.match(worker, /SELECT \* FROM requirement_groups/);
  assert.match(requirementTreeBuilder, /min_credits:\s*\"min_credits\"/);
  assert.match(requirementTreeBuilder, /max_credits:\s*\"max_credits\"/);
  assert.match(frontend, /groupProgress\(g\)/);
  assert.match(frontend, /courses.*credits applied/);
  assert.match(frontend, /g\.rule!==\"all\"&&g\.rule!==\"one_of\"&&!isCreditRule\(g\)/);
});
