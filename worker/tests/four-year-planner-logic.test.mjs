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
  assert.equal(result.status, "complete");
  assert.equal(result.issues.some((issue) => issue.code === "locked_prerequisite_violation"), false);
});

test("reports a locked prerequisite violation after generation when no earlier path exists", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: [{ code: "01:198:112", credits: 4 }],
    lockedPlacements: { "01:198:112": { year: 1, sem: "spring", locked: true } },
    prerequisitePathsByCode: { "01:198:112": [["01:198:111"]] },
  });

  assert.equal(result.status, "partial");
  assert.ok(result.issues.some((issue) => issue.code === "locked_prerequisite_violation"));
});

test("uses 18 credits before a locked dependent rather than placing its prerequisite too late", () => {
  const flexible = Array.from({ length: 5 }, (_, index) => ({ code: `01:198:${200 + index}`, credits: 3 }));
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: [{ code: "01:198:111", credits: 3 }, { code: "01:198:112", credits: 3 }, ...flexible],
    lockedPlacements: {
      "01:198:112": { year: 1, sem: "spring", locked: true },
      ...Object.fromEntries(flexible.map((course) => [course.code, { year: 1, sem: "fall", locked: true }])),
    },
    prerequisitePathsByCode: { "01:198:112": [["01:198:111"]] },
    targetCredits: 16,
    maxCredits: 18,
  });

  assert.equal(result.schedule["01:198:111"].sem, "fall");
  assert.equal(result.termCredits["1:fall"], 18);
  assert.equal(result.status, "complete");
  assert.equal(result.issues.some((issue) => issue.code === "locked_prerequisite_violation"), false);
});

test("schedules a transitive prerequisite closure before its locked dependent deadline", () => {
  const fallLocks = Array.from({ length: 5 }, (_, index) => ({ code: `01:198:${200 + index}`, credits: 3 }));
  const springLocks = Array.from({ length: 5 }, (_, index) => ({ code: `01:198:${300 + index}`, credits: 3 }));
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }, { year: 2, sem: "fall" }],
    courses: [
      { code: "01:198:111", credits: 3 },
      { code: "01:198:112", credits: 3 },
      { code: "01:198:211", credits: 3 },
      ...fallLocks,
      ...springLocks,
    ],
    lockedPlacements: {
      "01:198:211": { year: 2, sem: "fall", locked: true },
      ...Object.fromEntries(fallLocks.map((course) => [course.code, { year: 1, sem: "fall", locked: true }])),
      ...Object.fromEntries(springLocks.map((course) => [course.code, { year: 1, sem: "spring", locked: true }])),
    },
    prerequisitePathsByCode: {
      "01:198:112": [["01:198:111"]],
      "01:198:211": [["01:198:112"]],
    },
    targetCredits: 16,
    maxCredits: 18,
  });

  assert.equal(result.schedule["01:198:111"]?.sem, "fall");
  assert.equal(result.schedule["01:198:112"]?.sem, "spring");
  assert.equal(result.termCredits["1:fall"], 18);
  assert.equal(result.termCredits["1:spring"], 18);
  assert.equal(result.status, "complete");
  assert.equal(result.issues.some((issue) => issue.code === "locked_prerequisite_violation"), false);
});

test("deadline-constrains only the selected locked prerequisite alternative", () => {
  const fallLocks = Array.from({ length: 5 }, (_, index) => ({ code: `01:198:${400 + index}`, credits: 3 }));
  const springLocks = Array.from({ length: 4 }, (_, index) => ({ code: `01:198:${500 + index}`, credits: 3 }));
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }, { year: 2, sem: "fall" }],
    courses: [
      { code: "01:198:111", credits: 3 },
      { code: "01:198:112", credits: 3 },
      { code: "01:198:211", credits: 3 },
      ...fallLocks,
      ...springLocks,
    ],
    lockedPlacements: {
      "01:198:211": { year: 1, sem: "spring", locked: true },
      ...Object.fromEntries(fallLocks.map((course) => [course.code, { year: 1, sem: "fall", locked: true }])),
      ...Object.fromEntries(springLocks.map((course) => [course.code, { year: 1, sem: "spring", locked: true }])),
    },
    prerequisitePathsByCode: { "01:198:211": [["01:198:111"], ["01:198:112"]] },
    targetCredits: 16,
    maxCredits: 18,
  });

  assert.equal(result.schedule["01:198:111"]?.sem, "fall");
  assert.equal(result.schedule["01:198:112"]?.year, 2);
  assert.equal(result.schedule["01:198:112"]?.sem, "fall");
  assert.equal(result.status, "complete");
  assert.equal(result.issues.some((issue) => issue.code === "locked_prerequisite_violation"), false);
});

test("skips an infeasible first locked prerequisite alternative for a viable later path", () => {
  const fallLocks = Array.from({ length: 5 }, (_, index) => ({ code: `01:198:${400 + index}`, credits: 3 }));
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }, { year: 2, sem: "fall" }],
    courses: [
      { code: "01:198:111", credits: 4 },
      { code: "01:198:112", credits: 3 },
      { code: "01:198:211", credits: 3 },
      ...fallLocks,
    ],
    lockedPlacements: {
      "01:198:211": { year: 1, sem: "spring", locked: true },
      ...Object.fromEntries(fallLocks.map((course) => [course.code, { year: 1, sem: "fall", locked: true }])),
    },
    prerequisitePathsByCode: { "01:198:211": [["01:198:111"], ["01:198:112"]] },
    targetCredits: 16,
    maxCredits: 18,
  });

  assert.equal(result.schedule["01:198:112"]?.sem, "fall");
  assert.equal(result.schedule["01:198:111"]?.year, 2);
  assert.equal(result.schedule["01:198:111"]?.sem, "fall");
  assert.equal(result.status, "complete");
  assert.equal(result.issues.some((issue) => issue.code === "locked_prerequisite_violation"), false);
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
  assert.equal(result.termCredits["1:fall"], 18);
  assert.ok(result.issues.some((issue) => issue.code === "courses_unplaced"));
});

test("normalizes finite target credits into the agreed 14 to 16 range", () => {
  assert.equal(planner().normalizePlannerInput({ targetCredits: 3 }).targetCredits, 14);
  assert.equal(planner().normalizePlannerInput({ targetCredits: 15 }).targetCredits, 15);
  assert.equal(planner().normalizePlannerInput({ targetCredits: 30 }).targetCredits, 16);
});

test("defaults invalid or missing target credits to 16", () => {
  assert.equal(planner().normalizePlannerInput({}).targetCredits, 16);
  assert.equal(planner().normalizePlannerInput({ targetCredits: null }).targetCredits, 16);
  assert.equal(planner().normalizePlannerInput({ targetCredits: "15" }).targetCredits, 16);
  assert.equal(planner().normalizePlannerInput({ targetCredits: "invalid" }).targetCredits, 16);
  assert.equal(planner().normalizePlannerInput({ targetCredits: Infinity }).targetCredits, 16);
});

test("balances flexible work across the available planning horizon", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: Array.from({ length: 6 }, (_, index) => ({ code: `01:198:${100 + index}`, credits: 3 })),
    targetCredits: 16,
    maxCredits: 18,
  });

  assert.equal(result.status, "complete");
  assert.equal(result.termCredits["1:fall"], 9);
  assert.equal(result.termCredits["1:spring"], 9);
});

test("balances placeholders with concrete work", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: Array.from({ length: 4 }, (_, index) => ({ code: `01:198:${100 + index}`, credits: 3 })),
    unresolvedRequirements: [{ id: "core", label: "Core choice", credits: 3, sourceType: "core" }],
    targetCredits: 16,
    maxCredits: 18,
  });

  assert.equal(result.placeholders[0].sem, "fall");
  assert.equal(result.termCredits["1:fall"], 9);
  assert.equal(result.termCredits["1:spring"], 6);
});

test("spreads a four-year workload across all eight Fall and Spring terms", () => {
  const terms = Array.from({ length: 8 }, (_, index) => ({
    year: Math.floor(index / 2) + 1,
    sem: index % 2 ? "spring" : "fall",
  }));
  const result = planner().generatePlan({
    terms,
    courses: Array.from({ length: 16 }, (_, index) => ({ code: `01:198:${String(100 + index)}`, credits: 3 })),
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(Object.values(result.termCredits), Array(8).fill(6));
  assert.equal(Object.keys(result.schedule).length, 16);
});

test("enforces the six-course term limit independently of the credit cap", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: Array.from({ length: 7 }, (_, index) => ({ code: `01:198:${String(100 + index)}`, credits: 1 })),
  });

  assert.equal(Object.keys(result.schedule).length, 6);
  assert.ok(result.issues.some((issue) => issue.code === "courses_unplaced"));
});

test("honors standing and confirmed-prior-credit gates", () => {
  const terms = [
    { year: 1, sem: "fall" }, { year: 1, sem: "spring" },
    { year: 2, sem: "fall" }, { year: 2, sem: "spring" },
    { year: 3, sem: "fall" }, { year: 3, sem: "spring" },
  ];
  const result = planner().generatePlan({
    terms,
    confirmedCredits: 45,
    courses: [
      { code: "01:198:300", title: "Junior course", credits: 3, minimumPlanYear: 3 },
      { code: "01:198:301", title: "Sixty-credit course", credits: 3, minimumPriorCredits: 60 },
      ...Array.from({ length: 5 }, (_, index) => ({ code: `01:198:${String(200 + index)}`, credits: 3 })),
    ],
  });

  assert.ok(result.schedule["01:198:300"].year >= 3);
  const creditGate = result.schedule["01:198:301"];
  const priorPlanned = Object.values(result.schedule)
    .filter((entry) => (entry.year - 1) * 2 + (entry.sem === "spring" ? 1 : 0) < (creditGate.year - 1) * 2 + (creditGate.sem === "spring" ? 1 : 0))
    .reduce((total, entry) => total + entry.credits, 0);
  assert.ok(45 + priorPlanned >= 60);
});

test("counts unresolved requirement credits toward later standing gates", () => {
  const terms = Array.from({ length: 8 }, (_, ordinal) => ({
    year: Math.floor(ordinal / 2) + 1,
    sem: ordinal % 2 ? "spring" : "fall",
  }));
  const result = planner().generatePlan({
    terms,
    courses: [{ code: "33:136:470", title: "Business Data Management", credits: 3, minimumPriorCredits: 18 }],
    unresolvedRequirements: Array.from({ length: 8 }, (_, index) => ({
      id: `core-${index}`,
      label: `Core choice ${index + 1}`,
      credits: 3,
      sourceType: "core",
    })),
  });

  assert.ok(result.schedule["33:136:470"], "the later course should be placed once estimated Core credits satisfy the gate");
  assert.equal(result.issues.some((issue) => issue.code === "courses_unplaced"), false);
  assert.ok(result.schedule["33:136:470"].year >= 4);
});

test("allows a reviewed co-requisite in the same term", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    courses: [
      { code: "01:198:201", credits: 3, corequisitePaths: [["01:198:202"]] },
      { code: "01:198:202", credits: 1 },
    ],
  });

  assert.equal(result.status, "complete");
  const target = result.schedule["01:198:201"];
  const corequisite = result.schedule["01:198:202"];
  const targetOrdinal = (target.year - 1) * 2 + (target.sem === "spring" ? 1 : 0);
  const corequisiteOrdinal = (corequisite.year - 1) * 2 + (corequisite.sem === "spring" ? 1 : 0);
  assert.ok(corequisiteOrdinal <= targetOrdinal);
});

test("preserves course metadata and reports input uncertainty without dropping courses", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: [{
      code: "01:198:111", title: "Introduction to Computer Science", credits: 3,
      creditsEstimated: true, ruleCoverage: "unresolved",
    }],
    issues: [{ code: "estimated_course_credits", severity: "warning", courseCode: "01:198:111" }],
  });

  assert.equal(result.schedule["01:198:111"].title, "Introduction to Computer Science");
  assert.equal(result.schedule["01:198:111"].creditsEstimated, true);
  assert.ok(result.issues.some((issue) => issue.code === "estimated_course_credits"));
  assert.ok(result.issues.some((issue) => issue.code === "eligibility_rule_unresolved"));
  assert.equal(result.status, "complete");
});

test("places required courses before wishlist courses and does not fail on optional overflow", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }],
    courses: [
      ...Array.from({ length: 6 }, (_, index) => ({ code: `01:198:${String(100 + index)}`, credits: 1 })),
      { code: "01:198:999", title: "Wishlist", credits: 1, optional: true },
    ],
  });

  assert.equal(Object.keys(result.schedule).length, 6);
  assert.equal(result.schedule["01:198:999"], undefined);
  assert.equal(result.issues.some((issue) => issue.code === "courses_unplaced"), false);
  assert.ok(result.issues.some((issue) => issue.code === "optional_courses_unplaced"));
  assert.equal(result.status, "complete");
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
  assert.equal(result.schedule["01:198:201"].sem, "spring");
  assert.equal(result.status, "complete");
});

test("keeps room for an unlocked prerequisite chain instead of balancing its first course too late", () => {
  const terms = Array.from({ length: 8 }, (_, ordinal) => ({
    year: Math.floor(ordinal / 2) + 1,
    sem: ordinal % 2 ? "spring" : "fall",
  }));
  const result = planner().generatePlan({
    terms,
    courses: [
      ...Array.from({ length: 6 }, (_, index) => ({ code: `01:198:${100 + index}`, credits: 3 })),
      { code: "33:011:301", credits: 1, minimumPlanYear: 2 },
      { code: "33:011:302", credits: 1, minimumPlanYear: 2 },
      { code: "33:011:303", credits: 1, minimumPlanYear: 3 },
    ],
    prerequisitePathsByCode: {
      "33:011:302": [["33:011:301"]],
      "33:011:303": [["33:011:302"]],
    },
  });

  assert.ok(result.schedule["33:011:301"]);
  assert.ok(result.schedule["33:011:302"]);
  assert.ok(result.schedule["33:011:303"]);
  assert.equal(result.issues.some((issue) => issue.code === "courses_unplaced"), false);
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

test("an unresolved elective slot is placed only after one candidate prerequisite path", () => {
  const result = planner().generatePlan({
    terms: [
      { year: 1, sem: "fall" },
      { year: 1, sem: "spring" },
      { year: 2, sem: "fall" },
      { year: 2, sem: "spring" },
    ],
    courses: [{ code: "01:640:251", title: "Multivariable Calculus", credits: 4 }],
    lockedPlacements: {
      "01:640:251": { year: 2, sem: "fall", locked: true },
    },
    unresolvedRequirements: [{
      id: "math-elective-1",
      label: "Course 1 of 4 for Mathematics electives",
      credits: 3,
      sourceType: "program",
      prerequisitePaths: [["01:640:251"]],
    }],
  });

  const prerequisite = result.schedule["01:640:251"];
  const slot = result.placeholders[0];
  const prerequisiteOrdinal = (prerequisite.year - 1) * 2 + (prerequisite.sem === "spring" ? 1 : 0);
  const slotOrdinal = (slot.year - 1) * 2 + (slot.sem === "spring" ? 1 : 0);

  assert.ok(slotOrdinal > prerequisiteOrdinal);
});

test("plans that require more credits than the available terms report the capacity gap", () => {
  const result = planner().generatePlan({
    terms: [{ year: 1, sem: "fall" }, { year: 1, sem: "spring" }],
    maxCredits: 18,
    courses: Array.from({ length: 10 }, (_, index) => ({
      code: `01:198:${String(index + 100).padStart(3, "0")}`,
      title: `Course ${index + 1}`,
      credits: 4,
    })),
  });

  assert.deepEqual(JSON.parse(JSON.stringify(
    result.issues.find((issue) => issue.code === "plan_capacity_exceeded"),
  )), {
    code: "plan_capacity_exceeded",
    severity: "error",
    requiredCredits: 40,
    availableCredits: 36,
    overByCredits: 4,
  });
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
