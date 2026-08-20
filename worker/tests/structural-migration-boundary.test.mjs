import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

test("all maintained SQL lives in the root structural migration boundary", async () => {
  const files = (await readdir(new URL("migrations/", ROOT)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(files.length, 28);
  await assert.rejects(access(new URL("worker/schema/", ROOT)));
});

test("structural migrations do not backfill academic catalog content", async () => {
  const files = await readdir(new URL("migrations/", ROOT));
  for (const name of files.filter((value) => value.endsWith(".sql"))) {
    const sql = await readFile(new URL(`migrations/${name}`, ROOT), "utf8");
    if (name !== "schema.sql") {
      assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE)\b/i, name);
    }
  }
});

test("reviewed snapshots own requirement display-family values", async () => {
  const lines = (await readFile(
    new URL("catalog/snapshots/reviewed-programs.v1.jsonl", ROOT),
    "utf8",
  )).trim().split("\n");
  const definitions = lines.map((line) => JSON.parse(line));
  const businessCore = definitions.flatMap((definition) =>
    definition.requirement_groups.filter(
      (group) => group.display_family === "rbsnb-business-core",
    )
  );
  assert.ok(businessCore.length >= 6);
  assert.ok(businessCore.some((group) => group.display_priority === 100));
  assert.ok(businessCore.some((group) => group.display_priority === 10));
});
