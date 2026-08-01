import assert from "node:assert/strict";
import test from "node:test";
import { webApplicationSource } from "./helpers/web-source.mjs";

test("the browser upgrades a saved catalog-only selection when its reviewed replacement is published", async () => {
  const page = webApplicationSource;
  assert.match(page, /catalog_program_id/);
  assert.match(page, /catalogReplacements/);
  assert.match(page, /migratedSelections=.*catalogReplacements\.get/);
  assert.match(page, /ST\.selectedPrograms=migratedSelections/);
});
