import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCatalogSourceSnapshot,
  serializeCatalogSourceSnapshot,
} from "../src/index.ts";
import { sourceBundle } from "./fixtures.ts";

test("serializes deterministic source configuration with an inventory digest", async () => {
  const first = await serializeCatalogSourceSnapshot(sourceBundle(), {
    generated_at: 1785542400000,
  });
  const reversed = sourceBundle();
  const sources = reversed.sources as Array<Record<string, unknown>>;
  (sources[0]!.owner_labels as unknown[]).reverse();
  (sources[0]!.identity_overrides as unknown[]).reverse();
  const second = await serializeCatalogSourceSnapshot(reversed, {
    generated_at: 1785542400000,
  });
  assert.equal(first.json, second.json);
  assert.equal(first.manifest.sha256, second.manifest.sha256);
  assert.deepEqual(
    await parseCatalogSourceSnapshot(first.json, first.manifest),
    await parseCatalogSourceSnapshot(second.json, second.manifest),
  );
});

test("rejects tampered snapshots and mismatched inventories", async () => {
  const snapshot = await serializeCatalogSourceSnapshot(sourceBundle(), {
    generated_at: 1785542400000,
  });
  await assert.rejects(
    parseCatalogSourceSnapshot(`${snapshot.json} `, snapshot.manifest),
    /digest/,
  );
  await assert.rejects(
    parseCatalogSourceSnapshot(snapshot.json, {
      ...snapshot.manifest,
      row_counts: { ...snapshot.manifest.row_counts, sources: 2 },
    }),
    /inventory/,
  );
});
