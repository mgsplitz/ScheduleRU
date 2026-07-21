import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const moduleUrl = new URL("../../planner-state-logic.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}
const logic = context.globalThis.ScheduleRUPlannerStateLogic;
const plannerLogic = () => {
  assert.ok(logic, "ScheduleRUPlannerStateLogic must be exposed on globalThis");
  return logic;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("exposes the planner-state public API", () => {
  assert.ok(logic, "ScheduleRUPlannerStateLogic must be exposed on globalThis");
  for (const name of [
    "STATE_VERSION", "migratePlannerState", "normalizeAcademicRecord",
    "academicCreditEntries", "termKey", "preferencesForTerm", "withAcceptedPlan",
  ]) {
    assert.ok(name in logic, `ScheduleRUPlannerStateLogic must expose ${name}`);
  }
});

test("migrates an existing plan without moving scheduled courses", () => {
  const state = plannerLogic().migratePlannerState({
    version: 2,
    schedule: { "01:198:111": { code: "01:198:111", year: 1, sem: "fall" } },
    selectedProgramIds: [12],
  });
  assert.equal(state.version, 3);
  assert.equal(state.schedule["01:198:111"].sem, "fall");
  assert.equal(state.schedule["01:198:111"].locked, true);
  assert.deepEqual(plain(state.selectedProgramIds), [12]);
});

test("records AP 4 and 5 as reviewed-credit candidates and lower scores as unapplied", () => {
  assert.equal(plannerLogic().normalizeAcademicRecord({ type: "ap", exam: "Calculus AB", score: 4 }).creditStatus, "review_required");
  assert.equal(plannerLogic().normalizeAcademicRecord({ type: "ap", exam: "Calculus AB", score: 3 }).creditStatus, "not_applied");
});

test("accepting a preview replaces only the plan and clears the preview", () => {
  const state = plannerLogic().migratePlannerState({ version: 3, wishlist: { x: true } });
  const preview = { schedule: { a: { code: "a" } } };
  const accepted = plannerLogic().withAcceptedPlan({ ...state, generatedPlanPreview: preview }, preview);
  assert.deepEqual(plain(accepted.wishlist), { x: true });
  assert.equal(accepted.generatedPlanPreview, null);
  assert.equal(accepted.schedule.a.code, "a");
});
