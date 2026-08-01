import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("the maintained documentation tree excludes transient agent plans", () => {
  const transientDocs = existsSync(`${root}docs/superpowers`)
    ? readdirSync(`${root}docs/superpowers`, { recursive: true })
        .filter((name) => String(name).endsWith(".md"))
    : [];

  assert.deepEqual(transientDocs, []);
  assert.equal(existsSync(`${root}SCHEDULERU_IMPLEMENTATION_ROADMAP.md`), false);
  assert.equal(existsSync(`${root}RBS_AREAS_OF_STUDY_IMPORT.md`), false);
});

test("the documentation index points contributors to maintained boundaries", () => {
  const index = readFileSync(`${root}docs/README.md`, "utf8");

  assert.match(index, /architecture\/refactor-foundation\.md/);
  assert.match(index, /catalog-contributor\/README\.md/);
  assert.match(index, /reference-data-contributor\/README\.md/);
  assert.match(index, /catalog-ingestion\/README\.md/);
});
