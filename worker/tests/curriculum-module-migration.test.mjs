import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../schema/schema_curriculum_modules.sql", import.meta.url), "utf8");
const programs = await readFile(new URL("../src/programs.js", import.meta.url), "utf8");

test("the shared Rutgers-New Brunswick Core is canonical and attached to RBS through reviewed data", () => {
  assert.match(migration, /'rutgers-nb-core-curriculum'/);
  assert.match(migration, /'Rutgers-New Brunswick Core Curriculum'/);
  assert.match(migration, /'rbsnb'[\s\S]*?'core_curriculum'[\s\S]*?'rutgers-nb-core-curriculum'/);
  assert.match(migration, /review_status = 'reviewed'/);
});

test("the public Core route resolves a school attachment instead of its program owner", () => {
  assert.match(programs, /FROM school_curriculum_modules link/);
  assert.match(programs, /link\.school_slug = \?/);
  assert.match(programs, /const RUTGERS_NB_CORE_PROGRAM_ID = "rutgers-nb-core-curriculum"/);
  assert.doesNotMatch(programs, /const RBS_CORE_PROGRAM_ID/);
});

test("reviewed RBS records with no catalog year are made transparently current-source-only", () => {
  assert.match(migration, /Current RBS page \(catalog year not stated\)/);
  assert.match(migration, /school_slug = 'rbsnb'/);
  assert.match(migration, /catalog_year IS NULL/);
});
