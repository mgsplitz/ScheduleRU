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
    "deriveAcademicCalendarStartYear", "calendarYearForPlanTerm", "lockedPlacementsForTerms",
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
  assert.equal(state.version, 5);
  assert.equal(state.schedule["01:198:111"].sem, "fall");
  assert.equal(state.schedule["01:198:111"].locked, true);
  assert.deepEqual(plain(state.selectedProgramIds), [12]);
});

test("derives and preserves a stable academic calendar anchor", () => {
  const state = plannerLogic().migratePlannerState({
    academicPosition: { year: 2, startingSemester: "fall" },
    academicCalendarStartYear: 2025,
  });
  assert.equal(state.academicCalendarStartYear, 2025);
  assert.equal(plannerLogic().deriveAcademicCalendarStartYear({ year: 2, startingSemester: "fall" }, 2026), 2025);
  assert.equal(plannerLogic().deriveAcademicCalendarStartYear({ year: 2, startingSemester: "spring" }, 2026), 2024);
  assert.equal(plannerLogic().calendarYearForPlanTerm(2025, 2, "spring"), 2027);
});

test("migrates existing placements as locked and sends only explicitly locked courses to the planner", () => {
  const state = plannerLogic().migratePlannerState({
    schedule: {
      "01:198:111": { code: "01:198:111", year: 2, sem: "fall" },
      "01:198:112": { code: "01:198:112", year: 2, sem: "spring", locked: false },
    },
  });
  const locked = plannerLogic().lockedPlacementsForTerms(state.schedule, [
    { year: 2, sem: "fall" }, { year: 2, sem: "spring" },
  ]);
  assert.equal(state.schedule["01:198:111"].locked, true);
  assert.equal(state.schedule["01:198:111"].userPinned, true);
  assert.equal(state.schedule["01:198:112"].locked, false);
  assert.equal(state.schedule["01:198:112"].userPinned, false);
  assert.deepEqual(plain(Object.keys(locked)), ["01:198:111"]);
});

test("records AP 4 and 5 as reviewed-credit candidates and lower scores as unapplied", () => {
  assert.equal(plannerLogic().normalizeAcademicRecord({ type: "ap", exam: "Calculus AB", score: 4 }).creditStatus, "review_required");
  assert.equal(plannerLogic().normalizeAcademicRecord({ type: "ap", exam: "Calculus AB", score: 3 }).creditStatus, "not_applied");
});

test("preserves applied AP credit only for a reviewed valid equivalency", () => {
  const state = plannerLogic().migratePlannerState({
    academicRecords: [
      {
        id: "ap:calc-ab",
        type: "ap",
        exam: "Calculus AB",
        score: 4,
        credits: 4,
        creditStatus: "applied",
        equivalencyReviewStatus: "reviewed",
        equivalentCourseCodes: ["01:640:151", "invalid"],
      },
      {
        id: "ap:no-equivalency",
        type: "ap",
        exam: "Unmatched Exam",
        score: 5,
        creditStatus: "applied",
        equivalencyReviewStatus: "reviewed",
        equivalentCourseCodes: ["invalid"],
      },
    ],
  });

  assert.equal(state.academicRecords[0].creditStatus, "applied");
  assert.equal(state.academicRecords[1].creditStatus, "review_required");
  assert.deepEqual(plain(plannerLogic().academicCreditEntries(state)), [{
    id: "ap:calc-ab",
    source: "ap",
    credits: 4,
    course_code: "",
    equivalent_course_codes: ["01:640:151"],
  }]);
});

test("defaults malformed academic records to an empty array", () => {
  let state;
  assert.doesNotThrow(() => {
    state = plannerLogic().migratePlannerState({ academicRecords: { malformed: true } });
  });
  assert.deepEqual(plain(state.academicRecords), []);
});

test("accepting a preview replaces unlocked work, preserves pins, and persists placeholders", () => {
  const state = plannerLogic().migratePlannerState({
    version: 4,
    wishlist: { x: true },
    schedule: {
      "01:198:111": { code: "01:198:111", title: "Pinned", year: 1, sem: "fall", locked: true, userPinned: true },
      "01:198:112": { code: "01:198:112", title: "Old generated", year: 1, sem: "spring", locked: false, userPinned: false },
    },
  });
  const preview = {
    schedule: {
      "01:198:111": { code: "01:198:111", title: "Planner copy", year: 2, sem: "fall", locked: false },
      "01:198:205": { code: "01:198:205", title: "Discrete Structures", year: 2, sem: "spring", locked: false },
    },
    placeholders: [{ id: "core-a", label: "Core choice", year: 2, sem: "spring", estimatedCredits: 3 }],
  };
  const accepted = plannerLogic().withAcceptedPlan({ ...state, generatedPlanPreview: preview }, preview);
  assert.deepEqual(plain(accepted.wishlist), { x: true });
  assert.equal(accepted.generatedPlanPreview, null);
  assert.equal(accepted.schedule["01:198:112"], undefined);
  assert.equal(accepted.schedule["01:198:111"].year, 1);
  assert.equal(accepted.schedule["01:198:111"].title, "Pinned");
  assert.equal(accepted.schedule["01:198:111"].userPinned, true);
  assert.equal(accepted.schedule["01:198:205"].locked, false);
  assert.equal(accepted.schedule["01:198:205"].userPinned, false);
  assert.deepEqual(plain(accepted.planPlaceholders), preview.placeholders);
});
