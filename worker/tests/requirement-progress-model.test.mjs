import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../packages/requirements/src/requirement-group-logic.js");

const moduleUrl = new URL(
  "../../packages/requirements/src/requirement-progress-model.js",
  import.meta.url,
);
const context = {
  globalThis: {
    ScheduleRURequirementLogic: globalThis.ScheduleRURequirementLogic,
  },
};
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

const progressModel = () => {
  assert.ok(
    context.globalThis.ScheduleRURequirementProgressModel,
    "requirement-progress-model.js must expose ScheduleRURequirementProgressModel",
  );
  return context.globalThis.ScheduleRURequirementProgressModel;
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const group = (id, overrides = {}) => ({
  id,
  rule: "min",
  count: 1,
  members: [],
  children: [],
  courseSelectors: [],
  ...overrides,
});

test("allocation fingerprints ignore object insertion order and track every allocation input", () => {
  const first = {
    groups: {
      b: group("b", { members: ["two"] }),
      a: group("a", { members: ["one"] }),
    },
    completed: { ignored: false, one: true },
    apOn: { second: false, first: true },
    schedule: { two: { code: "02" }, one: { code: "01" } },
    groupSelections: { b: ["two"], a: ["one"] },
  };
  const reordered = {
    groups: { a: first.groups.a, b: first.groups.b },
    completed: { one: true, ignored: false },
    apOn: { first: true, second: false },
    schedule: { one: { code: "01" }, two: { code: "02" } },
    groupSelections: { a: ["one"], b: ["two"] },
  };

  const original = progressModel().allocationFingerprint(first);

  assert.equal(progressModel().allocationFingerprint(reordered), original);
  assert.notEqual(
    progressModel().allocationFingerprint({
      ...reordered,
      groupSelections: { a: ["different"], b: ["two"] },
    }),
    original,
  );
});

test("progress and fulfillment use the same applied-course view", () => {
  const groups = {
    required: group("required", {
      count: 2,
      members: ["three-credit", "four-credit"],
    }),
  };
  const model = progressModel().create({
    getGroups: () => groups,
    getState: () => ({ completed: {}, apOn: {}, schedule: {}, groupSelections: {} }),
    isCompleted: () => false,
    selectedRequirementCourses: () => [],
    isConstraintGroup: () => false,
    baseAppliedCourseIds: () => ["three-credit", "four-credit"],
    courseCredits: (id) => ({ "three-credit": 3, "four-credit": 4 })[id],
  });

  assert.deepEqual(plain(model.groupAppliedCourseIds(groups.required)), [
    "three-credit",
    "four-credit",
  ]);
  assert.deepEqual(plain(model.groupProgress(groups.required)), {
    courses: 2,
    credits: 7,
  });
  assert.equal(model.groupFulfilled("required"), true);
});

test("exclusive allocation is deterministic and recomputes when scheduling state changes", () => {
  const allocation = { allocation_family: "shared", max_uses: 1 };
  const groups = {
    alpha: group("alpha", { members: ["shared"], allocation }),
    beta: group("beta", { members: ["shared"], allocation }),
  };
  const state = {
    completed: {},
    apOn: {},
    schedule: { shared: { code: "shared" } },
    groupSelections: {},
  };
  const model = progressModel().create({
    getGroups: () => groups,
    getState: () => state,
    isCompleted: () => false,
    selectedRequirementCourses: () => [],
    isConstraintGroup: () => false,
    baseAppliedCourseIds: () => state.schedule.shared ? ["shared"] : [],
    courseCredits: () => 3,
  });

  assert.deepEqual(plain(model.groupAppliedCourseIds(groups.alpha)), ["shared"]);
  assert.deepEqual(plain(model.groupAppliedCourseIds(groups.beta)), []);

  delete state.schedule.shared;

  assert.deepEqual(plain(model.groupAppliedCourseIds(groups.alpha)), []);
  assert.deepEqual(plain(model.groupAppliedCourseIds(groups.beta)), []);
});
