import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../packages/planner/src/course-set-optimizer.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
const plain = (value) => JSON.parse(JSON.stringify(value));

function optimizer() {
  assert.ok(
    context.globalThis.ScheduleRUCourseSetOptimizer,
    "course-set-optimizer.js must expose ScheduleRUCourseSetOptimizer",
  );
  return context.globalThis.ScheduleRUCourseSetOptimizer;
}

const requirement = (id, extras = {}) => ({
  id,
  requirementGroupId: id,
  sourceProgram: "program",
  sourceType: "program",
  label: id,
  slotCount: 1,
  canDefer: false,
  ...extras,
});
const candidate = (code, coverageRequirementIds, extras = {}) => ({
  code,
  title: code,
  credits: 3,
  equivalentCourseCodes: [code],
  coverageRequirementIds,
  prerequisiteClosure: [],
  offeringEvidence: { sections: 1 },
  ...extras,
});

test("chooses one legal overlapping course before two redundant courses", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("major"), requirement("core", { sourceType: "core" })],
    candidates: [
      candidate("01:730:104", ["major", "core"], { credits: 4 }),
      candidate("01:730:103", ["major"]),
      candidate("01:355:101", ["core"]),
    ],
    conflicts: [],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), ["01:730:104"]);
  assert.deepEqual(plain(result.selectedCourses[0].coverageRequirementIds), ["core", "major"]);
});

test("a nested upper-level subset never reduces a six-course minor to three courses", () => {
  const requirements = [
    requirement("philosophy-total", { slotCount: 6 }),
    requirement("philosophy-upper", { slotCount: 3 }),
  ];
  const candidates = [
    candidate("01:730:301", ["philosophy-total", "philosophy-upper"]),
    candidate("01:730:302", ["philosophy-total", "philosophy-upper"]),
    candidate("01:730:303", ["philosophy-total", "philosophy-upper"]),
    candidate("01:730:103", ["philosophy-total"]),
    candidate("01:730:104", ["philosophy-total"]),
    candidate("01:730:218", ["philosophy-total"]),
  ];

  const result = optimizer().optimizeCourseSet({ requirements, candidates, conflicts: [] });

  assert.equal(result.status, "complete");
  assert.equal(result.selectedCourses.length, 6);
  assert.equal(result.selectedCourses.filter((course) =>
    course.coverageRequirementIds.includes("philosophy-upper")).length, 3);
});

test("respects Core allocation-family and zero-overlap conflicts", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [
      requirement("wcr", { sourceType: "core", allocationFamily: "writing" }),
      requirement("wcd", { sourceType: "core", allocationFamily: "writing" }),
      requirement("major", { sourceProgram: "major" }),
      requirement("minor", { sourceProgram: "minor" }),
    ],
    candidates: [
      candidate("01:730:104", ["wcr", "wcd"]),
      candidate("01:355:201", ["wcr"]),
      candidate("01:355:202", ["wcd"]),
      candidate("01:198:111", ["major", "minor"]),
      candidate("01:198:112", ["major"]),
      candidate("01:198:205", ["minor"]),
    ],
    conflicts: [
      { type: "allocation_family", candidateCode: "01:730:104", requirementIds: ["wcr", "wcd"], allocationFamily: "writing" },
      { type: "double_count_cap", candidateCode: "01:198:111", programIds: ["major", "minor"], maxSharedCourses: 0 },
    ],
  });

  assert.equal(result.status, "complete");
  const selected = result.selectedCourses.map((item) => item.code);
  assert.equal(selected.includes("01:730:104") && selected.length < 4, false);
  assert.equal(result.selectedCourses.find((item) => item.code === "01:198:111")
    ?.coverageRequirementIds.length, 1);
});

test("interest breaks equal-cost ties after coverage and credits", () => {
  const graph = {
    requirements: [requirement("elective")],
    candidates: [
      candidate("01:198:314", ["elective"]),
      candidate("01:198:336", ["elective"]),
    ],
    conflicts: [],
  };
  const result = optimizer().optimizeCourseSet(graph, {
    elective: { interested: ["01:198:336"], maybe: [], avoid: ["01:198:314"] },
  });

  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), ["01:198:336"]);
});

test("an avoided gateway can be added when it is necessary for an interested course", () => {
  const graph = {
    requirements: [requirement("elective")],
    candidates: [
      candidate("01:198:111", []),
      candidate("01:198:314", ["elective"], { prerequisiteClosure: ["01:198:111"] }),
    ],
    conflicts: [],
  };
  const result = optimizer().optimizeCourseSet(graph, {
    elective: { interested: ["01:198:314"], maybe: [], avoid: ["01:198:111"] },
  });

  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), ["01:198:111", "01:198:314"]);
  assert.deepEqual(plain(result.explanations), [{
    type: "preference_override",
    courseCode: "01:198:111",
    reason: "prerequisite",
    unlocksCourseCodes: ["01:198:314"],
  }]);
});

test("selects one prerequisite alternative instead of every OR branch", () => {
  const graph = {
    requirements: [requirement("advanced-writing")],
    candidates: [
      candidate("01:355:101", [], { title: "College Writing" }),
      candidate("01:355:103", [], { title: "Exposition and Argument" }),
      candidate("01:355:104", [], { title: "College Writing Extended" }),
      candidate("01:730:410", ["advanced-writing"], {
        title: "History of Analytic Philosophy",
        prerequisitePaths: [
          ["01:355:101"],
          ["01:355:103"],
          ["01:355:104"],
        ],
        prerequisiteClosure: ["01:355:101", "01:355:103", "01:355:104"],
      }),
    ],
    conflicts: [],
  };

  const result = optimizer().optimizeCourseSet(graph);

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), [
    "01:355:101",
    "01:730:410",
  ]);
});

test("chooses the prerequisite route with the smallest transitive course burden", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("advanced")],
    candidates: [
      candidate("01:100:100", [], {
        prerequisitePaths: [["01:100:090", "01:100:091"]],
        prerequisiteClosure: ["01:100:090", "01:100:091"],
      }),
      candidate("01:100:101", []),
      candidate("01:100:090", []),
      candidate("01:100:091", []),
      candidate("01:200:400", ["advanced"], {
        prerequisitePaths: [["01:100:100"], ["01:100:101"]],
        prerequisiteClosure: ["01:100:100", "01:100:101"],
      }),
    ],
    conflicts: [],
  });

  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), [
    "01:100:101",
    "01:200:400",
  ]);
});

test("reuses a course already in the four-year plan instead of adding a duplicate prerequisite route", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("calculus-two")],
    candidates: [
      candidate("01:640:135", [], { title: "Calculus I for Life and Social Sciences" }),
      candidate("01:640:151", [], { title: "Calculus I for Mathematical and Physical Sciences" }),
      candidate("01:640:152", ["calculus-two"], {
        title: "Calculus II for Mathematical and Physical Sciences",
        prerequisitePaths: [["01:640:135"], ["01:640:151"]],
        prerequisiteClosure: ["01:640:135", "01:640:151"],
      }),
    ],
    conflicts: [],
    plannedCourseCodes: ["01:640:151"],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), ["01:640:152"]);
});

test("adds missing prerequisite support for fixed courses already required by the degree", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("writing")],
    candidates: [
      candidate("01:355:101", ["writing"], { title: "College Writing" }),
      candidate("01:640:115", [], { title: "Precalculus College Mathematics" }),
      candidate("01:640:151", [], {
        title: "Calculus I",
        prerequisitePaths: [["01:640:115"]],
        enforceablePrerequisitePaths: [["01:640:115"]],
        ruleCoverage: "reviewed",
        prerequisiteClosure: ["01:640:115"],
      }),
    ],
    conflicts: [],
    plannedCourseCodes: ["01:640:151"],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), [
    "01:355:101",
    "01:640:115",
  ]);
  assert.equal(result.selectedCourses.find((item) => item.code === "01:640:115")?.prerequisiteOnly, true);
});

test("does not invent off-plan preparation from a catalog-parsed fixed course", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("writing")],
    candidates: [
      candidate("01:355:101", ["writing"], { title: "College Writing" }),
      candidate("01:640:112", [], { title: "Precalculus Part II", ruleCoverage: "catalog_parsed" }),
      candidate("01:640:151", [], {
        title: "Calculus I",
        prerequisitePaths: [["01:640:112"]],
        enforceablePrerequisitePaths: [["01:640:112"]],
        ruleCoverage: "catalog_parsed",
        prerequisiteClosure: ["01:640:112"],
      }),
    ],
    conflicts: [],
    plannedCourseCodes: ["01:640:151"],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), ["01:355:101"]);
});

test("catalog-parsed prerequisites already required by the plan still establish the sequence", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("writing")],
    candidates: [
      candidate("01:355:101", ["writing"], { title: "College Writing" }),
      candidate("01:640:151", [], { title: "Calculus I", ruleCoverage: "catalog_parsed" }),
      candidate("01:640:152", [], {
        title: "Calculus II",
        prerequisitePaths: [["01:640:151"]],
        enforceablePrerequisitePaths: [["01:640:151"]],
        ruleCoverage: "catalog_parsed",
        prerequisiteClosure: ["01:640:151"],
      }),
    ],
    conflicts: [],
    plannedCourseCodes: ["01:640:151", "01:640:152"],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), ["01:355:101"]);
});

test("does not auto-enroll a student in an unrequested honors shortcut", () => {
  const graph = {
    requirements: [requirement("differential-equations")],
    candidates: [
      candidate("01:640:151", [], { title: "Calculus I" }),
      candidate("01:640:152", [], {
        title: "Calculus II",
        prerequisitePaths: [["01:640:151"]],
        prerequisiteClosure: ["01:640:151"],
      }),
      candidate("01:640:251", [], {
        title: "Multivariable Calculus",
        prerequisitePaths: [["01:640:152"]],
        prerequisiteClosure: ["01:640:152"],
      }),
      candidate("01:640:291", [], { title: "Honors Calculus III" }),
      candidate("01:640:244", ["differential-equations"], {
        title: "Differential Equations for Engineering and Physics",
        prerequisitePaths: [["01:640:251"], ["01:640:291"]],
        prerequisiteClosure: ["01:640:251", "01:640:291"],
      }),
    ],
    conflicts: [],
  };

  const result = optimizer().optimizeCourseSet(graph);
  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), [
    "01:640:151",
    "01:640:152",
    "01:640:244",
    "01:640:251",
  ]);

  const honorsRequested = optimizer().optimizeCourseSet(graph, {
    "differential-equations": { interested: ["01:640:291"], maybe: [], avoid: [] },
  });
  assert.deepEqual(plain(honorsRequested.selectedCourses.map((item) => item.code)), [
    "01:640:244",
    "01:640:291",
  ]);
});

test("prefers a fully modeled prerequisite route over a code-only alternative", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("differential-equations")],
    candidates: [
      candidate("01:640:251", [], { title: "Multivariable Calculus", credits: 4 }),
      candidate("01:640:244", ["differential-equations"], {
        title: "Differential Equations for Engineering and Physics",
        prerequisitePaths: [["01:640:243"], ["01:640:251"]],
        prerequisiteClosure: ["01:640:243", "01:640:251"],
      }),
    ],
    conflicts: [],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses.map((item) => item.code)), [
    "01:640:244",
    "01:640:251",
  ]);
  assert.equal(result.selectedCourses.every((course) => course.title !== course.code), true);
});

test("explicitly deferred Core work remains deferred instead of receiving a guessed course", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("cco", { sourceType: "core", canDefer: true })],
    candidates: [candidate("01:220:110", ["cco"])],
    conflicts: [],
  }, { cco: { mode: "deferred" } });

  assert.equal(result.status, "complete");
  assert.deepEqual(plain(result.selectedCourses), []);
  assert.deepEqual(plain(result.deferredRequirements), ["cco"]);
});

test("a multi-slot requirement selects distinct courses and asks for all slots", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("philosophy", { slotCount: 2 })],
    candidates: [
      candidate("01:730:103", ["philosophy"]),
      candidate("01:730:104", ["philosophy"]),
      candidate("01:730:218", ["philosophy"]),
    ],
    conflicts: [],
  });

  assert.equal(result.status, "complete");
  assert.equal(result.selectedCourses.length, 2);
});

test("one plan never selects two interchangeable courses from the same option family", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("mathematics", { slotCount: 2 })],
    candidates: [
      candidate("01:640:244", ["mathematics"], { optionFamily: "differential-equations" }),
      candidate("01:640:252", ["mathematics"], { optionFamily: "differential-equations" }),
      candidate("01:640:300", ["mathematics"]),
    ],
    conflicts: [],
  });

  assert.equal(result.status, "complete");
  const chosenAlternatives = result.selectedCourses.filter((course) => course.optionFamily === "differential-equations");
  assert.equal(chosenAlternatives.length, 1);
  assert.equal(result.selectedCourses.some((course) => course.code === "01:640:300"), true);
});

test("one plan respects authoritative credit-exclusion families across requirements", () => {
  const family = "rutgers-nb-college-writing-credit";
  const result = optimizer().optimizeCourseSet({
    requirements: [
      requirement("college-writing"),
      requirement("writing-elective"),
    ],
    candidates: [
      candidate("01:355:101", ["college-writing"], {
        creditExclusionFamilies: [family],
      }),
      candidate("01:355:103", ["writing-elective"], {
        creditExclusionFamilies: [family],
      }),
      candidate("01:355:201", ["writing-elective"]),
    ],
    conflicts: [],
  });

  assert.equal(result.status, "complete");
  assert.equal(
    result.selectedCourses.filter((course) =>
      course.creditExclusionFamilies?.includes(family)).length,
    1,
  );
  assert.equal(result.selectedCourses.some(({ code }) => code === "01:355:201"), true);
});

test("completed equivalent credit blocks every duplicate option before optimization", () => {
  const writingFamily = "rutgers-nb-college-writing-credit";
  const differentialFamily = "rutgers-nb-differential-equations-credit";
  const result = optimizer().optimizeCourseSet({
    requirements: [
      requirement("writing-elective"),
      requirement("mathematics"),
    ],
    candidates: [
      candidate("01:355:103", ["writing-elective"], {
        creditExclusionFamilies: [writingFamily],
      }),
      candidate("01:355:201", ["writing-elective"]),
      candidate("01:640:244", ["mathematics"], {
        creditExclusionFamilies: [differentialFamily],
      }),
      candidate("01:640:300", ["mathematics"]),
    ],
    conflicts: [],
    completedCourseCodes: ["01:355:101", "01:640:252"],
    completedCreditExclusionFamilies: [writingFamily, differentialFamily],
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(
    plain(result.selectedCourses.map((course) => course.code)),
    ["01:355:201", "01:640:300"],
  );
});

test("a completed alias blocks the same canonical candidate", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("computing")],
    candidates: [
      candidate("01:198:111", ["computing"], {
        equivalentCourseCodes: ["01:198:110", "01:198:111"],
      }),
      candidate("01:198:112", ["computing"]),
    ],
    conflicts: [],
    completedCourseCodes: ["01:198:110"],
  });

  assert.deepEqual(plain(result.selectedCourses.map((course) => course.code)), ["01:198:112"]);
});

test("a distinct Core requirement uses different reviewed subgoals", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("ah", {
      sourceType: "core", slotCount: 2, distinctAttributes: ["AHo", "AHp", "AHq", "AHr"],
    })],
    candidates: [
      candidate("01:730:103", ["ah"], { attributes: ["AHo"] }),
      candidate("01:730:104", ["ah"], { attributes: ["AHo", "WCr"] }),
      candidate("01:730:218", ["ah"], { attributes: ["AHp"] }),
    ],
    conflicts: [],
  });

  assert.equal(result.status, "complete");
  assert.equal(result.selectedCourses.some((item) => item.code === "01:730:218"), true);
  assert.equal(result.selectedCourses.filter((item) => ["01:730:103", "01:730:104"].includes(item.code)).length, 1);
});

test("identical inputs produce byte-equivalent results", () => {
  const graph = {
    requirements: [requirement("elective")],
    candidates: [candidate("01:198:336", ["elective"]), candidate("01:198:314", ["elective"])],
    conflicts: [],
  };
  const first = optimizer().optimizeCourseSet(graph);
  const second = optimizer().optimizeCourseSet(graph);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.selectedCourses[0].code, "01:198:314");
});

test("returns indeterminate rather than a partial guess when its safety limit is reached", () => {
  const result = optimizer().optimizeCourseSet({
    requirements: [requirement("elective")],
    candidates: [candidate("01:198:314", ["elective"]), candidate("01:198:336", ["elective"])],
    conflicts: [],
  }, {}, { nodeLimit: 0 });

  assert.equal(result.status, "indeterminate");
  assert.deepEqual(plain(result.selectedCourses), []);
});

test("keeps a complete policy-valid result found before the optimizer safety limit", () => {
  const { optimizeCourseSet } = optimizer();
  const requirements = Array.from({ length: 6 }, (_, index) => ({
    id: `r${index + 1}`, requirementGroupId: `g${index + 1}`, slotCount: 1,
  }));
  const candidates = Array.from({ length: 18 }, (_, index) => ({
    code: `01:000:${String(index + 1).padStart(3, "0")}`,
    title: `Course ${index + 1}`,
    credits: 3,
    offeringEvidence: true,
    equivalentCourseCodes: [`01:000:${String(index + 1).padStart(3, "0")}`],
    coverageRequirementIds: [`r${(index % 6) + 1}`],
    prerequisiteClosure: [`01:999:${String(index + 1).padStart(3, "0")}`],
  }));
  const result = optimizeCourseSet(
    { requirements, candidates, conflicts: [] }, {}, { nodeLimit: 10, component: true },
  );
  assert.equal(result.status, "complete");
  assert.equal(result.selectedCourses.filter((item) => !item.prerequisiteOnly).length, 6);
  assert.equal(result.issues[0]?.type, "optimizer_limit_reached_after_complete_result");
});

test("collapses redundant large pools while preserving a later interested choice", () => {
  const requirements = Array.from({ length: 8 }, (_, index) => requirement(`r${index}`));
  const candidates = requirements.flatMap((item, requirementIndex) =>
    Array.from({ length: 100 }, (_, index) => candidate(
      `01:${String(100 + requirementIndex).padStart(3, "0")}:${String(100 + index).padStart(3, "0")}`,
      [item.id],
    )));
  const preferred = candidates.find((item) => item.coverageRequirementIds[0] === "r7" && item.code.endsWith(":199"));
  const result = optimizer().optimizeCourseSet(
    { requirements, candidates, conflicts: [] },
    { r7: { interested: [preferred.code], maybe: [], avoid: [] } },
    { nodeLimit: 1000 },
  );

  assert.equal(result.status, "complete");
  assert.equal(result.selectedCourses.some((item) => item.code === preferred.code), true);
});
