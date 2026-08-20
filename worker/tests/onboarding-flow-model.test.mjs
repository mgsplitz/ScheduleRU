import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/onboarding-flow-model.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function model() {
  assert.ok(context.globalThis.ScheduleRUOnboardingFlowModel, "onboarding flow model must be exposed");
  return context.globalThis.ScheduleRUOnboardingFlowModel;
}

test("onboarding follows programs, coursework, AP, then review", () => {
  assert.deepEqual(Array.from(model().steps()), ["welcome", "programs", "coursework", "ap", "review"]);
  assert.equal(model().stepAt(-1), "welcome");
  assert.equal(model().stepAt(99), "review");
  assert.equal(model().move(1, "back"), 0);
  assert.equal(model().move(3, "next"), 4);
});

test("program summaries identify primary, secondary, and minor roles", () => {
  const rows = model().programRoleRows({
    programs: [
      { id: "finance", name: "Finance", type: "major" },
      { id: "bait", name: "BAIT", type: "major" },
      { id: "philosophy", name: "Philosophy", type: "minor" },
    ],
    primaryId: "finance",
    secondaryId: "bait",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
    { id: "finance", name: "Finance", role: "Primary major" },
    { id: "bait", name: "BAIT", role: "Secondary major" },
    { id: "philosophy", name: "Philosophy", role: "Minor" },
  ]);
});

test("manual coursework supports all Rutgers teaching seasons", () => {
  assert.deepEqual(Array.from(model().courseworkTerms()), ["Fall", "Spring", "Summer", "Winter"]);
});
