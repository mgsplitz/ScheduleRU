import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {} };
for (const file of ["eligibility-logic.js", "academic-credit-logic.js", "planner-input-logic.js", "four-year-planner-logic.js", "planner-state-logic.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"), context);
}
const { ScheduleRUPlannerInput: adapter, ScheduleRUFourYearPlanner: engine, ScheduleRUPlannerStateLogic: stateLogic } = context.globalThis;

const plain = (value) => JSON.parse(JSON.stringify(value));

test("requirement trees generate and accept a visible eight-term plan end to end", () => {
  const terms = Array.from({ length: 8 }, (_, index) => ({
    year: Math.floor(index / 2) + 1,
    sem: index % 2 ? "spring" : "fall",
  }));
  const fixedCourses = Object.fromEntries(Array.from({ length: 15 }, (_, index) => {
    const code = `01:198:${String(100 + index)}`;
    return [`course-${index}`, {
      code,
      title: `Required course ${index + 1}`,
      credits: index === 0 ? "" : "3",
      ...(index === 14 ? { alternatives: [{ code: "01:198:099" }] } : {}),
    }];
  }));
  const tree = {
    roots: ["root"],
    courses: fixedCourses,
    groups: {
      root: { id: "root", rule: "all", members: [], children: ["fixed", "elective"] },
      fixed: { id: "fixed", name: "Required courses", rule: "all", members: Object.keys(fixedCourses), children: [] },
      elective: { id: "elective", name: "Choose one program elective", rule: "min", count: 1, members: [], children: [] },
    },
  };
  const pinnedCode = "01:198:100";
  const currentState = stateLogic.migratePlannerState({
    schedule: {
      [pinnedCode]: { code: pinnedCode, title: "Required course 1", credits: 3, year: 4, sem: "spring", locked: true, userPinned: true },
      "01:198:999": { code: "01:198:999", title: "Old generated course", credits: 3, year: 1, sem: "fall", locked: false, userPinned: false },
    },
  });
  const canonical = adapter.buildPlannerInput({
    terms,
    requirementTrees: [{ id: "computer-science", tree }],
    schedule: currentState.schedule,
    completedCourseCodes: ["01:198:099"],
  });
  const preview = engine.generatePlan(canonical);
  const accepted = stateLogic.withAcceptedPlan(currentState, preview);

  assert.equal(preview.status, "complete");
  assert.equal(Object.keys(preview.schedule).length, 14);
  assert.ok(Object.values(preview.schedule).every((entry) => entry.credits > 0 && entry.title));
  assert.ok(Object.values(preview.termCredits).every((credits) => credits <= 18));
  for (const term of terms) {
    assert.ok(Object.values(preview.schedule).filter((entry) => entry.year === term.year && entry.sem === term.sem).length <= 6);
  }
  assert.equal(accepted.schedule["01:198:999"], undefined);
  assert.equal(accepted.schedule[pinnedCode].year, 4);
  assert.equal(accepted.schedule[pinnedCode].sem, "spring");
  assert.equal(accepted.schedule[pinnedCode].userPinned, true);
  assert.ok(Object.values(accepted.schedule).filter((entry) => entry.code !== pinnedCode).every((entry) => entry.userPinned === false));
  assert.deepEqual(plain(accepted.planPlaceholders.map((entry) => entry.requirementGroupId)), ["elective"]);
});

test("reviewed College Writing stays prerequisite-free through end-to-end generation", () => {
  const terms = Array.from({ length: 8 }, (_, index) => ({
    year: Math.floor(index / 2) + 1,
    sem: index % 2 ? "spring" : "fall",
  }));
  const tree = {
    roots: ["root"],
    courses: {
      collegeWriting: {
        code: "01:355:101",
        title: "COLLEGE WRITING",
        credits: "3",
        catalogPrereqs: "01:355:100 BASIC COMPOSITION OR 01:356:156 ACADEMIC WRITING",
        eligibility: {
          review: {
            course_code: "01:355:101",
            review_status: "reviewed",
            no_known_conditions: 1,
          },
          conditions: [],
        },
      },
      nextWriting: {
        code: "01:355:201",
        title: "RESEARCH IN THE DISCIPLINES",
        credits: "3",
        prerequisiteCodes: ["01:355:101"],
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Writing sequence",
        rule: "all",
        members: ["collegeWriting", "nextWriting"],
        children: [],
      },
    },
  };

  const canonical = adapter.buildPlannerInput({
    terms,
    requirementTrees: [{ id: "sas-core", tree }],
  });
  const preview = engine.generatePlan(canonical);
  const scheduledCodes = new Set(Object.keys(preview.schedule));

  assert.equal(preview.status, "complete");
  assert.equal(scheduledCodes.has("01:355:101"), true);
  assert.equal(scheduledCodes.has("01:355:201"), true);
  assert.equal(scheduledCodes.has("01:355:100"), false);
  assert.equal(scheduledCodes.has("01:356:156"), false);
  assert.deepEqual(plain(canonical.prerequisitePathsByCode["01:355:101"] || []), []);
  assert.ok(
    preview.schedule["01:355:101"].year < preview.schedule["01:355:201"].year
      || (
        preview.schedule["01:355:101"].year === preview.schedule["01:355:201"].year
        && preview.schedule["01:355:101"].sem === "fall"
        && preview.schedule["01:355:201"].sem === "spring"
      ),
  );
});
