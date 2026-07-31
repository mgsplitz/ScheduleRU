import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const referenceData = JSON.parse(await readFile(
  new URL("../../reference-data/snapshots/reviewed-reference-data.v1.json", import.meta.url),
  "utf8",
));
const catalog = (await readFile(
  new URL("../../catalog/snapshots/reviewed-programs.v1.jsonl", import.meta.url),
  "utf8",
)).trim().split("\n").map(JSON.parse);
const programs = await readFile(new URL("../src/programs.js", import.meta.url), "utf8");

test("the shared Rutgers-New Brunswick Core is canonical and attached to RBS through reviewed data", () => {
  const core = catalog.find(({ program }) =>
    program.id === "rutgers-nb-core-curriculum"
  );
  assert.equal(core.program.name, "Rutgers-New Brunswick Core Curriculum");
  assert.ok(referenceData.school_curriculum_modules.some((module) =>
    module.school_slug === "rbsnb"
    && module.module_type === "core_curriculum"
    && module.curriculum_program_id === core.program.id
    && module.review_status === "reviewed"
  ));
});

test("the public Core route resolves a school attachment instead of its program owner", () => {
  assert.match(programs, /FROM school_curriculum_modules link/);
  assert.match(programs, /link\.school_slug = \?/);
  assert.match(programs, /const RUTGERS_NB_CORE_PROGRAM_ID = "rutgers-nb-core-curriculum"/);
  assert.doesNotMatch(programs, /const RBS_CORE_PROGRAM_ID/);
});

test("reviewed RBS records with no catalog year are made transparently current-source-only", () => {
  const concentrations = catalog.filter(({ program }) =>
    program.school_slug === "rbsnb" && program.type === "concentration"
  );
  assert.ok(concentrations.length > 0);
  assert.ok(concentrations.every(({ program }) =>
    program.catalog_year === "Current RBS page (catalog year not stated)"
  ));
});
