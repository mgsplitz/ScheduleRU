import assert from "node:assert/strict";
import test from "node:test";

import { validateCatalogSourceBundle } from "../src/index.ts";
import { sourceBundle } from "./fixtures.ts";

test("accepts a complete program-directory source configuration", () => {
  assert.equal(validateCatalogSourceBundle(sourceBundle()).ok, true);
});

test("rejects non-Rutgers sources and duplicate identity overrides", () => {
  const value = sourceBundle();
  const sources = value.sources as Array<Record<string, unknown>>;
  sources[0]!.directory_url = "https://example.com/programs";
  const overrides =
    sources[0]!.identity_overrides as Array<Record<string, unknown>>;
  overrides.push(structuredClone(overrides[0]!));

  const result = validateCatalogSourceBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path, code }) => ({ path, code })),
    [
      {
        path: "sources[0].directory_url",
        code: "invalid_source_url",
      },
      {
        path: "sources[0].identity_overrides[1]",
        code: "duplicate_key",
      },
    ],
  );
});

test("rejects unsupported adapters, unsafe paths, and ambiguous owner labels", () => {
  const value = sourceBundle();
  const sources = value.sources as Array<Record<string, unknown>>;
  sources[0]!.adapter = "execute_arbitrary_code";
  sources[0]!.profile_path = "https://other.example/path";
  sources[0]!.owner_labels = ["Example School", "Example School"];

  const result = validateCatalogSourceBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    [
      "sources[0].profile_path",
      "sources[0].adapter",
      "sources[0].owner_labels[1]",
    ],
  );
});
