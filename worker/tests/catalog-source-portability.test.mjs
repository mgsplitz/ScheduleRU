import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseCatalogSourceSnapshot,
} from "../../packages/catalog-sources/src/index.ts";

const ROOT = new URL("../../", import.meta.url);

test("reviewed catalog-source configuration is digest-checked portable data", async () => {
  const json = await readFile(
    new URL(
      "catalog-sources/snapshots/reviewed-catalog-sources.v1.json",
      ROOT,
    ),
    "utf8",
  );
  const manifest = JSON.parse(await readFile(
    new URL(
      "catalog-sources/snapshots/reviewed-catalog-sources.v1.manifest.json",
      ROOT,
    ),
    "utf8",
  ));
  const bundle = await parseCatalogSourceSnapshot(json, manifest);
  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].identity_overrides.length, 2);
});

test("catalog-source structural migrations contain no source content", async () => {
  for (const path of [
    "worker/schema/schema_program_catalog_imports.sql",
    "worker/schema/migrate_program_catalog_source_ownership.sql",
  ]) {
    const sql = await readFile(new URL(path, ROOT), "utf8");
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE)\b/i, path);
    assert.doesNotMatch(sql, /sasnb-official-directory/, path);
  }
});
