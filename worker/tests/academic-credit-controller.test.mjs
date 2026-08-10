import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/academic-credit-controller.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function controller(overrides = {}) {
  assert.ok(
    context.globalThis.ScheduleRUAcademicCreditController,
    "academic-credit-controller.js must expose ScheduleRUAcademicCreditController",
  );
  return context.globalThis.ScheduleRUAcademicCreditController.create({
    baseConfirmedEntries: () => [{ courseCode: "01:198:111", credits: 4 }],
    additionalConfirmedEntries: () => [{ courseCode: "01:640:151", credits: 4 }],
    baseIsCompleted: (id) => id === "legacy-complete",
    additionalCompletedCourseCodes: () => ["01:640:151"],
    courseCodeForId: (id) => id === "math-id" ? "01:640:151" : id,
    normalizeCourseId: (code) => String(code).replaceAll(":", ""),
    ...overrides,
  });
}

test("confirmed entries compose persisted and guided academic credit", () => {
  const app = controller();

  assert.deepEqual(
    JSON.parse(JSON.stringify(app.confirmedEntries())),
    [
      { courseCode: "01:198:111", credits: 4 },
      { courseCode: "01:640:151", credits: 4 },
    ],
  );
});

test("completion preserves planner rules and adds normalized guided credit", () => {
  const app = controller();

  assert.equal(app.isCompleted("legacy-complete"), true);
  assert.equal(app.isCompleted("math-id"), true);
  assert.equal(app.isCompleted("01:220:102"), false);
});

test("providers are evaluated from current state instead of captured snapshots", () => {
  let codes = [];
  const app = controller({ additionalCompletedCourseCodes: () => codes });

  assert.equal(app.isCompleted("math-id"), false);
  codes = ["01:640:151"];
  assert.equal(app.isCompleted("math-id"), true);
});
