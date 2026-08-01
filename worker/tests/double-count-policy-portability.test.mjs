import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, snapshot] = await Promise.all([
  readFile(
    new URL("../../migrations/schema_double_count_policies.sql", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL(
      "../../reference-data/snapshots/reviewed-reference-data.v1.json",
      import.meta.url,
    ),
    "utf8",
  ).then(JSON.parse),
]);

test("school-wide double-count policy SQL is structural only", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS double_count_policies/);
  assert.doesNotMatch(schema, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/);
});

test("reviewed RBS overlap caps are portable reference data", () => {
  assert.deepEqual(
    snapshot.double_count_policies.map(
      ({ school_slug, scope, max_shared_courses }) => ({
        school_slug,
        scope,
        max_shared_courses,
      }),
    ),
    [
      {
        school_slug: "rbsnb",
        scope: "major_concentration",
        max_shared_courses: 0,
      },
      {
        school_slug: "rbsnb",
        scope: "major_major",
        max_shared_courses: 1,
      },
    ],
  );
});
