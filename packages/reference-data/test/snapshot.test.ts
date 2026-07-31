import assert from "node:assert/strict";
import test from "node:test";

import {
  parseReferenceDataSnapshot,
  serializeReferenceDataSnapshot,
} from "../src/index.ts";
import { bundle } from "./fixtures.ts";

test("serializes a deterministic digest-checked bundle", async () => {
  const first = await serializeReferenceDataSnapshot(bundle(), {
    generated_at: 1785456000000,
  });
  const reversed = bundle();
  for (const value of Object.values(reversed)) {
    if (Array.isArray(value)) value.reverse();
  }
  const second = await serializeReferenceDataSnapshot(reversed, {
    generated_at: 1785456000000,
  });
  assert.equal(first.json, second.json);
  assert.equal(first.manifest.sha256, second.manifest.sha256);
  assert.deepEqual(
    await parseReferenceDataSnapshot(first.json, first.manifest),
    await parseReferenceDataSnapshot(second.json, second.manifest),
  );
});

test("rejects tampering and mismatched inventory", async () => {
  const snapshot = await serializeReferenceDataSnapshot(bundle(), {
    generated_at: 1785456000000,
  });
  await assert.rejects(
    parseReferenceDataSnapshot(`${snapshot.json} `, snapshot.manifest),
    /digest/,
  );
  await assert.rejects(
    parseReferenceDataSnapshot(snapshot.json, {
      ...snapshot.manifest,
      row_counts: { ...snapshot.manifest.row_counts, school_profiles: 99 },
    }),
    /inventory/,
  );
});
