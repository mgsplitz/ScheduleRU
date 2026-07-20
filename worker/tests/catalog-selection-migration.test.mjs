import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the browser upgrades a saved catalog-only selection when its reviewed replacement is published", async () => {
  const page = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(page, /catalog_program_id/);
  assert.match(page, /catalogReplacements/);
  assert.match(page, /migratedSelections=.*catalogReplacements\.get/);
  assert.match(page, /ST\.selectedPrograms=migratedSelections/);
});
