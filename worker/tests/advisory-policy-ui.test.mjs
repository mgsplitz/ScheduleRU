import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = await readFile(resolve(here, "../../index.html"), "utf8");

test("requirement notices use the API's structured advisory wording", () => {
  assert.match(indexHtml, /rule\.advisory_message\s*\|\|\s*rule\.note/);
  assert.match(indexHtml, /Planning notices from reviewed program sources/);
  assert.doesNotMatch(indexHtml, /Formal program conditions/);
});
