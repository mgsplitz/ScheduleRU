import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCatalogReviewBacklogSnapshot,
  serializeCatalogReviewBacklogSnapshot,
} from "../src/index.ts";
import { backlog } from "./fixtures.ts";

test("serializes review notes in deterministic natural-key order", async () => {
  const first = await serializeCatalogReviewBacklogSnapshot(backlog(), {
    generated_at: 1785542400000,
  });
  const reversed = backlog();
  (reversed.review_notes as unknown[]).reverse();
  const second = await serializeCatalogReviewBacklogSnapshot(reversed, {
    generated_at: 1785542400000,
  });
  assert.equal(first.json, second.json);
  assert.equal(first.manifest.sha256, second.manifest.sha256);
  assert.deepEqual(
    await parseCatalogReviewBacklogSnapshot(first.json, first.manifest),
    await parseCatalogReviewBacklogSnapshot(second.json, second.manifest),
  );
});

test("rejects tampering and a mismatched note count", async () => {
  const snapshot = await serializeCatalogReviewBacklogSnapshot(backlog(), {
    generated_at: 1785542400000,
  });
  await assert.rejects(
    parseCatalogReviewBacklogSnapshot(`${snapshot.json} `, snapshot.manifest),
    /digest/,
  );
  await assert.rejects(
    parseCatalogReviewBacklogSnapshot(snapshot.json, {
      ...snapshot.manifest,
      note_count: 99,
    }),
    /inventory/,
  );
});
