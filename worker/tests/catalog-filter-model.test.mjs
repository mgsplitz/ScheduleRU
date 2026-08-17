import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/catalog-filter-model.js", import.meta.url);
const context = { globalThis: {}, URLSearchParams };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function model() {
  assert.ok(context.globalThis.ScheduleRUCatalogFilterModel);
  return context.globalThis.ScheduleRUCatalogFilterModel;
}

test("catalog filters normalize and serialize every active dimension together", () => {
  const filters = model().normalize({
    search: "  writing  ",
    subject: "355",
    levels: [300],
    credits: [3],
    availability: "open",
    requirementIntentId: "core-wcr",
    coreCodes: ["WCr", "WCr"],
  });

  assert.deepEqual(JSON.parse(JSON.stringify(filters)), {
    search: "writing",
    subject: "355",
    levels: [300],
    credits: [3],
    availability: "open",
    requirementIntentId: "core-wcr",
    coreCodes: ["WCr"],
  });
  const params = model().toSearchParams(filters, { limit: 25, offset: 0 });
  assert.equal(params.get("search"), "writing");
  assert.equal(params.get("subject"), "355");
  assert.equal(params.get("levels"), "300");
  assert.equal(params.get("credits"), "3");
  assert.equal(params.get("availability"), "open");
  assert.equal(params.get("core"), "WCr");
});

test("Core codes come from structured bracket labels without a course list", () => {
  assert.equal(model().coreCodeFromLabel("Revision-Based Writing [WCr]"), "WCr");
  assert.equal(model().coreCodeFromLabel("Business Core"), null);
});

