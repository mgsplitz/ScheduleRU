import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";
import { webApplicationSource as frontend } from "./helpers/web-source.mjs";

const baseSchema = await readFile(new URL("../../migrations/schema_programs.sql", import.meta.url), "utf8");
const migration = await readFile(new URL("../../migrations/migrate_program_academic_metadata.sql", import.meta.url), "utf8");
test("new program databases support official code, degree type, and reviewed program family", () => {
  assert.match(baseSchema, /academic_program_code TEXT/);
  assert.match(baseSchema, /degree_type TEXT/);
  assert.match(baseSchema, /program_family_id TEXT/);
});

test("the one-time migration adds every academic metadata field", () => {
  assert.match(migration, /ALTER TABLE programs ADD COLUMN academic_program_code TEXT/);
  assert.match(migration, /ALTER TABLE programs ADD COLUMN degree_type TEXT/);
  assert.match(migration, /ALTER TABLE programs ADD COLUMN program_family_id TEXT/);
});

test("program seeding retains reviewed degree-path metadata", () => {
  assert.match(worker, /academic_program_code=excluded\.academic_program_code/);
  assert.match(worker, /degree_type=excluded\.degree_type/);
  assert.match(worker, /program_family_id=excluded\.program_family_id/);
  assert.match(frontend, /const degreeType = cleanText\(program\.degree_type\)/);
  assert.match(frontend, /programCoverageLabel\(program\), degreeType/);
});
