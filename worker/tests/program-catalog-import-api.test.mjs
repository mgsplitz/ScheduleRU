import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../src/programs.js", import.meta.url);

test("the public program API reads catalog-listed programs from D1 rather than a source manifest", async () => {
  const worker = await readFile(workerUrl, "utf8");

  assert.doesNotMatch(worker, /sas-catalog-manifest/);
  assert.match(worker, /program_catalog_sources/);
  assert.match(worker, /program_catalog_identity_overrides/);
  assert.match(worker, /owner_labels_json/);
  assert.match(worker, /\/api\/admin\/program-catalog\/import/);
  assert.match(worker, /catalog_active = 1/);
});

test("a catalog import holds a source-level lease while it updates the directory", async () => {
  const worker = await readFile(workerUrl, "utf8");

  assert.match(worker, /import_token = \?, import_started_at = \?/);
  assert.match(worker, /a catalog import for this source is already running/);
  assert.match(worker, /import_token = NULL, import_started_at = NULL/);
});

test("the generic Coursedog scraper does not overwrite RBS data", async () => {
  const worker = await readFile(workerUrl, "utf8");

  assert.match(worker, /Coursedog is not an approved RBS requirements source/);
  assert.match(worker, /school_slug !== "rbsnb"/);
});

test("program eligibility lookups batch ids so a full catalog cannot exceed D1's variable limit", async () => {
  const worker = await readFile(workerUrl, "utf8");

  assert.match(worker, /for \(let offset = 0; offset < ids\.length; offset \+= 100\)/);
});
