import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";

const publicProgramRoutes = await readFile(
  new URL("../../apps/api/src/programs/public-routes.js", import.meta.url),
  "utf8",
);

test("the public program API reads catalog-listed programs from D1 rather than a source manifest", async () => {
  assert.doesNotMatch(worker, /sas-catalog-manifest/);
  assert.match(worker, /program_catalog_sources/);
  assert.match(worker, /program_catalog_identity_overrides/);
  assert.match(worker, /owner_labels_json/);
  assert.match(worker, /\/api\/admin\/program-catalog\/import/);
  assert.match(worker, /catalog_active = 1/);
});

test("a catalog import holds a source-level lease while it updates the directory", async () => {
  assert.match(worker, /import_token = \?, import_started_at = \?/);
  assert.match(worker, /a catalog import for this source is already running/);
  assert.match(worker, /import_token = NULL, import_started_at = NULL/);
});

test("the generic Coursedog scraper does not overwrite RBS data", async () => {
  assert.match(worker, /Coursedog is not an approved RBS requirements source/);
  assert.match(worker, /school_slug !== "rbsnb"/);
});

test("program eligibility lookups batch ids so a full catalog cannot exceed D1's variable limit", async () => {
  assert.match(worker, /for \(let offset = 0; offset < ids\.length; offset \+= 100\)/);
});

test("public program and requirement routes hide catalog-only records", async () => {
  const publicRoutes = publicProgramRoutes.slice(
    publicProgramRoutes.indexOf('if (path === "/api/programs"'),
  );

  assert.match(publicRoutes, /review_status = 'reviewed'/);
  assert.doesNotMatch(publicRoutes, /review_status = 'catalog_listed'/);
  assert.match(publicRoutes, /publishedCatalogPrograms\(\[\], reviewedPrograms\)/);
});
