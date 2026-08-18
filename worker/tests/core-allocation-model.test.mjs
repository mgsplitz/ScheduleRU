import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL(
  "../../packages/requirements/src/core-allocation-model.js",
  import.meta.url,
);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}
const plain = (value) => JSON.parse(JSON.stringify(value));

function coreAllocation() {
  assert.ok(
    context.globalThis.ScheduleRUCoreAllocationModel,
    "core-allocation-model.js must expose ScheduleRUCoreAllocationModel",
  );
  return context.globalThis.ScheduleRUCoreAllocationModel;
}

function createModel(overrides = {}) {
  const groups = overrides.groups || {};
  return coreAllocation().create({
    getGroups: () => groups,
    getRootGroupIds: () => overrides.rootGroupIds || [],
    isCourseCompleted: overrides.isCourseCompleted || (() => false),
    getSelectedApAwards: () => overrides.apAwards || [],
    courseCodesFromText: (text) => String(text || "").match(/\b\d{2}:\d{3}:\d{3}\b/g) || [],
    requirementCourseId: (code) => String(code || "").replaceAll(":", ""),
    isApAllowedForGroup: overrides.isApAllowedForGroup || (() => true),
  });
}

test("requirement groups stop at allocatable leaves and expose their required counts", () => {
  const model = createModel({
    rootGroupIds: ["root"],
    groups: {
      root: { id: "root", rule: "all", children: ["container", "fixed"] },
      container: { id: "container", rule: "all", children: ["choice"] },
      choice: { id: "choice", rule: "min", count: 2, members: ["a", "b"] },
      fixed: { id: "fixed", rule: "distinct", count: 2, children: ["goal-a"] },
      "goal-a": { id: "goal-a", rule: "min", count: 1, members: ["a"] },
    },
  });

  assert.deepEqual([...model.requirementGroupIds("root")], ["choice", "fixed"]);
  assert.equal(model.groupNeeded({ rule: "min", count: "2" }), 2);
  assert.equal(model.groupNeeded({ rule: "distinct", count: 0 }), 1);
  assert.equal(model.groupNeeded({ rule: "all", count: 4 }), 0);
});

test("completion tokens include each completed course and each selected AP award once", () => {
  const completed = new Set(["01198111"]);
  const model = createModel({
    rootGroupIds: ["root"],
    groups: {
      root: { id: "root", rule: "all", children: ["courses"] },
      courses: {
        id: "courses",
        rule: "min",
        count: 1,
        members: ["01198111", "01640151", "01640135"],
      },
    },
    isCourseCompleted: (id) => completed.has(id),
    apAwards: [{
      id: "calculus",
      name: "Calculus AB",
      equiv: "01:640:151",
      fulfills: ["01640135"],
    }],
  });

  const tokens = model.completionTokens();
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].key, "course:01198111");
  assert.deepEqual([...tokens[0].courseIds], ["01198111"]);
  assert.equal(tokens[1].key, "ap:calculus");
  assert.deepEqual([...tokens[1].courseIds].sort(), ["01640135", "01640151"]);
});

test("maximum matching reallocates scarce evidence to complete more goals", () => {
  const model = createModel();
  const slots = [
    { key: "broad", courseIds: new Set(["a", "b"]), apAllowed: true },
    { key: "scarce", courseIds: new Set(["a"]), apAllowed: true },
  ];
  const tokens = [
    { key: "course:a", kind: "course", courseIds: new Set(["a"]) },
    { key: "course:b", kind: "course", courseIds: new Set(["b"]) },
  ];

  const matches = model.maximumMatching(slots, tokens);
  assert.equal(matches.length, 2);
  assert.deepEqual(
    plain(
      matches.map(({ slot, token }) => [slot.key, token.key]).sort(),
    ),
    [["broad", "course:b"], ["scarce", "course:a"]],
  );
});

test("allocation honors distinct goals and caller-provided AP restrictions", () => {
  const groups = {
    root: { id: "root", rule: "all", children: ["distinct", "writing"] },
    distinct: { id: "distinct", rule: "distinct", count: 2, children: ["goal-a", "goal-b"] },
    "goal-a": { id: "goal-a", rule: "min", count: 1, members: ["a"] },
    "goal-b": { id: "goal-b", rule: "min", count: 1, members: ["b"] },
    writing: { id: "writing", name: "Writing", rule: "min", count: 1, members: ["c"] },
  };
  const model = createModel({
    groups,
    rootGroupIds: ["root"],
    isCourseCompleted: (id) => id === "a",
    apAwards: [
      { id: "goal-b", name: "Goal B", equiv: "00:000:00b", fulfills: ["b"] },
      { id: "writing", name: "Writing", equiv: "00:000:00c", fulfills: ["c"] },
    ],
    isApAllowedForGroup: (group) => group.id !== "writing",
  });

  const allocation = model.allocate();
  assert.deepEqual(plain(allocation.byGroup.distinct.map((token) => token.key).sort()), [
    "ap:goal-b",
    "course:a",
  ]);
  assert.deepEqual(plain(allocation.byGroup["goal-a"].map((token) => token.key)), ["course:a"]);
  assert.deepEqual(plain(allocation.byGroup["goal-b"].map((token) => token.key)), ["ap:goal-b"]);
  assert.equal(allocation.byGroup.writing, undefined);
});

test("one course cannot fill both goals in an exclusive Core family but can cross Core families", () => {
  const groups = {
    writing: { id: "writing", rule: "all", children: ["wcr", "wcd"] },
    wcr: { id: "wcr", rule: "min", count: 1, members: ["shared"] },
    wcd: { id: "wcd", rule: "min", count: 1, members: ["shared"] },
    contemporary: { id: "contemporary", rule: "all", children: ["ccd"] },
    ccd: { id: "ccd", rule: "min", count: 1, members: ["shared"] },
  };
  const model = createModel({
    groups,
    rootGroupIds: ["writing", "contemporary"],
    isCourseCompleted: (id) => id === "shared",
  });

  const allocation = model.allocate();
  const writingUses = (allocation.byGroup.wcr?.length || 0) + (allocation.byGroup.wcd?.length || 0);
  assert.equal(writingUses, 1);
  assert.equal(allocation.byGroup.ccd.length, 1);
});
