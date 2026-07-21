import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

let logic;
try {
  const source = fs.readFileSync(new URL("../../four-year-planner-logic.js", import.meta.url), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  logic = context.globalThis.ScheduleRUFourYearPlanner;
} catch (error) {
  logic = null;
}

function planner() {
  assert.equal(typeof logic?.generatePlan, "function");
  assert.equal(typeof logic?.normalizePlannerInput, "function");
  assert.equal(typeof logic?.createPlaceholder, "function");
  return logic;
}

test("exposes the deterministic planner public API", () => {
  planner();
});

test("keeps locked placements and schedules prerequisites earlier", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: [{ code: "01:198:111", credits: 4 }, { code: "01:198:112", credits: 4 }],
    lockedPlacements: { "01:198:112": { year: 1, sem: "spring", locked: true } },
    prerequisitePathsByCode: { "01:198:112": [["01:198:111"]] },
    targetCredits: 16,
    maxCredits: 18,
  });
  assert.equal(result.schedule["01:198:112"].sem, "spring");
  assert.equal(result.schedule["01:198:111"].sem, "fall");
  assert.equal(result.schedule["01:198:112"].locked, true);
});

test("uses a typed placeholder instead of inventing an unresolved Core course", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: [],
    unresolvedRequirements: [{ id: "ccd", label: "Core: Contemporary Challenges", credits: 3, sourceType: "core" }],
  });
  assert.equal(result.placeholders[0].label, "Core: Contemporary Challenges");
  assert.equal(result.placeholders[0].kind, "requirement_placeholder");
  assert.equal(result.schedule[result.placeholders[0].id], undefined);
});

test("returns a partial plan instead of exceeding the hard credit cap", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: Array.from({ length: 7 }, (_, i) => ({ code: `01:198:${String(100 + i)}`, credits: 3 })),
    maxCredits: 18,
  });
  assert.equal(result.status, "partial");
  assert.ok(result.termCredits["1:fall"] <= 18);
  assert.ok(result.issues.some((issue) => issue.code === "courses_unplaced"));
});

test("chooses a complete reviewed prerequisite path deterministically", () => {
  const result = planner().generatePlan({
    terms: [
      { year: 1, sem: "fall" },
      { year: 1, sem: "spring" },
      { year: 2, sem: "fall" },
    ],
    courses: [
      { code: "01:198:101", credits: 3 },
      { code: "01:198:102", credits: 3 },
      { code: "01:198:201", credits: 3 },
    ],
    completedCourseCodes: ["01:198:101"],
    prerequisitePathsByCode: { "01:198:201": [["01:198:101"], ["01:198:102"]] },
  });
  assert.equal(result.schedule["01:198:201"].sem, "fall");
  assert.equal(result.status, "complete");
});

test("does not let a placeholder satisfy a reviewed prerequisite", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: [{ code: "01:198:201", credits: 3 }],
    prerequisitePathsByCode: { "01:198:201": [["01:198:101"]] },
    unresolvedRequirements: [{ id: "placeholder", label: "Any elective", credits: 3, sourceType: "elective" }],
  });
  assert.equal(result.status, "partial");
  assert.equal(result.schedule["01:198:201"], undefined);
  assert.ok(result.issues.some((issue) => issue.code === "courses_unplaced"));
  assert.equal(result.placeholders.length, 1);
});

test("reports invalid locks and prerequisite cycles without moving locked work", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: [{ code: "01:198:101", credits: 3 }, { code: "01:198:102", credits: 3 }],
    lockedPlacements: { "01:198:101": { year: 9, sem: "fall", locked: true } },
    prerequisitePathsByCode: {
      "01:198:101": [["01:198:102"]],
      "01:198:102": [["01:198:101"]],
    },
  });
  assert.equal(result.status, "partial");
  assert.equal(result.schedule["01:198:101"], undefined);
  assert.ok(result.issues.some((issue) => issue.code === "invalid_locked_placement" && issue.severity === "error"));
  assert.ok(result.issues.some((issue) => issue.code === "cyclic_prerequisite"));
});

test("normalizes equivalent input ordering into identical deterministic output", () => {
  const input = {
    terms: [{ year: 2, sem: "spring" }, { year: 1, sem: "spring" }, { year: 1, sem: "fall" }],
    courses: [{ code: "01:198:103", credits: 3 }, { code: "01:198:101", credits: 3 }, { code: "01:198:102", credits: 3 }],
    maxCredits: 6,
  };
  const first = planner().generatePlan(input);
  const second = planner().generatePlan({ ...input, terms: [...input.terms].reverse(), courses: [...input.courses].reverse() });
  assert.deepEqual(first, second);
});
