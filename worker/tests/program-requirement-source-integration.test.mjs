import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";

test("the Worker can register and bulk-import source drafts without publishing requirements", async () => {
  const schema = await readFile(
    new URL("../../migrations/schema_program_requirement_imports.sql", import.meta.url),
    "utf8",
  );

  assert.match(schema, /CREATE TABLE IF NOT EXISTS program_requirement_import_sources/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS program_requirement_source_snapshots/);
  assert.match(schema, /UNIQUE\(source_id, content_hash\)/);
  assert.match(worker, /\/api\/admin\/requirement-sources\/register/);
  assert.match(worker, /\/api\/admin\/requirement-sources\/import/);
  assert.match(worker, /review_status = 'catalog_listed'/);
  assert.doesNotMatch(worker, /UPDATE programs SET[\s\S]{0,160}review_status = 'reviewed'/);
});

test("school source imports queue a bounded batch of not-yet-snapshotted sources", async () => {
  assert.match(worker, /last_imported_at IS NULL/);
  assert.match(worker, /ORDER BY id\s+LIMIT \?/);
  assert.match(worker, /batchLimit/);
});

test("major discovery stores typed detail sources without publishing audits", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../../migrations/schema_program_requirement_imports.sql", import.meta.url), "utf8"),
    readFile(new URL("../../migrations/migrate_requirement_import_source_kinds.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /source_kind TEXT NOT NULL DEFAULT 'profile'/);
  assert.match(migration, /ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'profile'/);
  assert.match(worker, /\/api\/admin\/requirement-sources\/discover/);
  assert.match(worker, /type = 'major'/);
  assert.doesNotMatch(worker, /UPDATE programs SET[\s\S]{0,160}review_status = 'reviewed'/);
});

test("the Worker stores generic draft candidates separately from reviewed requirement audits", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../../migrations/schema_program_requirement_imports.sql", import.meta.url), "utf8"),
    readFile(new URL("../../migrations/migrate_requirement_draft_candidates.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS program_requirement_draft_candidates/);
  assert.match(schema, /UNIQUE\(source_id, content_hash, extractor_version\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS program_requirement_draft_candidates/);
  assert.match(worker, /\/api\/admin\/requirement-candidates\/extract/);
  assert.match(worker, /source\.source_kind = 'requirements_page'/);
  assert.match(worker, /extractRequirementDraftCandidate/);
});

test("the Worker can record one generic second-level major-requirements lookup per overview source", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../../migrations/schema_program_requirement_imports.sql", import.meta.url), "utf8"),
    readFile(new URL("../../migrations/migrate_requirement_source_discovery_attempts.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS program_requirement_source_discovery_attempts/);
  assert.match(schema, /UNIQUE\(parent_source_id, discovery_kind\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS program_requirement_source_discovery_attempts/);
  assert.match(worker, /\/api\/admin\/requirement-sources\/discover-details/);
  assert.match(worker, /source\.id LIKE 'detail-%'/);
  assert.match(worker, /discoverNestedMajorRequirementPage/);
});
