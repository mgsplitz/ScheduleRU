import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../src/programs.js", import.meta.url);

test("the public program API reads catalog-listed programs from D1 rather than a source manifest", async () => {
  const worker = await readFile(workerUrl, "utf8");

  assert.doesNotMatch(worker, /sas-catalog-manifest/);
  assert.match(worker, /program_catalog_sources/);
  assert.match(worker, /\/api\/admin\/program-catalog\/import/);
  assert.match(worker, /catalog_active = 1/);
});

test("program eligibility lookups batch ids so a full catalog cannot exceed D1's variable limit", async () => {
  const worker = await readFile(workerUrl, "utf8");

  assert.match(worker, /for \(let offset = 0; offset < ids\.length; offset \+= 100\)/);
});
