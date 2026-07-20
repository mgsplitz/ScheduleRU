import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Worker can register and bulk-import source drafts without publishing requirements", async () => {
  const [schema, worker] = await Promise.all([
    readFile(new URL("../schema/schema_program_requirement_imports.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/programs.js", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS program_requirement_import_sources/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS program_requirement_source_snapshots/);
  assert.match(schema, /UNIQUE\(source_id, content_hash\)/);
  assert.match(worker, /\/api\/admin\/requirement-sources\/register/);
  assert.match(worker, /\/api\/admin\/requirement-sources\/import/);
  assert.match(worker, /review_status = 'catalog_listed'/);
  assert.doesNotMatch(worker, /UPDATE programs SET[\s\S]{0,160}review_status = 'reviewed'/);
});
