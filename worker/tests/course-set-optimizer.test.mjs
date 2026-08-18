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

