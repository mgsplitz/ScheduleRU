import assert from "node:assert/strict";
import test from "node:test";

await import("../../requirement-group-logic.js");

const { groupFulfilled, groupProgress, allocateRequirementCourses } = globalThis.ScheduleRURequirementLogic;

function evaluate(groups, completed, appliedByGroup = {}, creditsByCourse = {}) {
  const taken = new Set(completed);
  return (groupId) => groupFulfilled(groupId, groups, {
    isCompleted: (courseId) => taken.has(courseId),
    selectedRequirementCourses: () => [],
    appliedCourseIds: (group) => appliedByGroup[group?.id] || [],
    courseCredits: (courseId) => creditsByCourse[courseId],
    isConstraintGroup: (group) => {
      const parent = groups[group?.parentId];
      if (!parent || parent.rule === "distinct" || !(group?.members || []).length || !(parent.members || []).length) return false;
      const parentMembers = new Set(parent.members);
      return group.members.every((courseId) => parentMembers.has(courseId));
    },
  });
}

test("a minimum-credit group sums applied courses with different credit values", () => {
  const groups = {
    elective: { id: "elective", rule: "min_credits", count: 7, members: ["three-credit", "four-credit", "one-credit"], children: [] },
  };
  const credits = { "three-credit": 3, "four-credit": 4, "one-credit": 1 };

  assert.equal(evaluate(groups, ["three-credit", "four-credit"], {}, credits)("elective"), true);
  assert.deepEqual(
    groupProgress(groups.elective, () => false, { appliedCourseIds: () => ["three-credit", "one-credit"], courseCredits: (id) => credits[id] }),
    { courses: 2, credits: 4 }
  );
});

test("a maximum-credit constraint rejects an over-limit partially completed group", () => {
  const groups = {
    electives: { id: "electives", rule: "min", count: 2, members: ["three-credit", "four-credit", "one-credit"], children: ["upper-level"] },
    "upper-level": { id: "upper-level", parentId: "electives", rule: "max_credits", count: 4, members: ["three-credit", "four-credit", "one-credit"], children: [] },
  };
  const credits = { "three-credit": 3, "four-credit": 4, "one-credit": 1 };

  assert.equal(evaluate(groups, ["three-credit", "one-credit"], {}, credits)("electives"), true);
  assert.equal(evaluate(groups, ["three-credit", "four-credit"], {}, credits)("electives"), false);
});

const leadershipElectives = {
  electives: {
    id: "electives",
    rule: "min",
    count: 2,
    members: ["primary-a", "primary-b", "support-a", "support-b"],
    children: ["primary"],
  },
  primary: {
    id: "primary",
    parentId: "electives",
    rule: "min",
    count: 1,
    members: ["primary-a", "primary-b"],
    children: [],
  },
};

test("a total-plus-subset rule rejects two supplemental electives", () => {
  assert.equal(evaluate(leadershipElectives, ["support-a", "support-b"])("electives"), false);
});

test("a reviewed selector-applied course fulfills a minimum group", () => {
  const groups = {
    elective: { id: "elective", rule: "min", count: 1, members: [], children: [] },
  };
  assert.equal(evaluate(groups, [], { elective: ["01790300"] })("elective"), true);
});

test("a selector-only all-course group fails closed instead of completing vacuously", () => {
  const groups = {
    invalid: { id: "invalid", rule: "all", count: 0, members: [], courseSelectors: [{ kind: "subject_level" }], children: [] },
  };
  assert.equal(evaluate(groups, [], { invalid: ["01790300"] })("invalid"), false);
});

test("a total-plus-subset rule accepts one primary and one supplemental elective", () => {
  assert.equal(evaluate(leadershipElectives, ["primary-a", "support-a"])("electives"), true);
});

test("a total-plus-subset rule accepts both primary electives", () => {
  assert.equal(evaluate(leadershipElectives, ["primary-a", "primary-b"])("electives"), true);
});

test("a nested maximum constraint continues to block an over-limit selection", () => {
  const groups = {
    electives: {
      id: "electives", rule: "min", count: 2,
      members: ["scm-a", "scm-b", "outside-a", "outside-b"], children: ["outside"],
    },
    outside: {
      id: "outside", parentId: "electives", rule: "max", count: 1,
      members: ["outside-a", "outside-b"], children: [],
    },
  };
  assert.equal(evaluate(groups, ["scm-a", "outside-a"])("electives"), true);
  assert.equal(evaluate(groups, ["scm-a", "outside-a", "outside-b"])("electives"), false);
});

test("an exclusive allocation family assigns one completed course to only one group with a stable tie-breaker", () => {
  const groups = {
    beta: { id: "beta", rule: "all", members: ["shared"], children: [], allocation: { allocation_family: "cross-listed", max_uses: 1 } },
    alpha: { id: "alpha", rule: "all", members: ["shared"], children: [], allocation: { allocation_family: "cross-listed", max_uses: 1 } },
  };

  const allocation = allocateRequirementCourses(groups, {
    isCompleted: (courseId) => courseId === "shared",
  });

  assert.deepEqual(allocation.appliedByGroup, { alpha: ["shared"], beta: [] });
});

test("exclusive allocation reallocates a shared course to maximize completed requirements", () => {
  const groups = {
    alpha: { id: "alpha", rule: "min", count: 1, members: ["fallback", "shared"], children: [], allocation: { allocation_family: "cross-listed", max_uses: 1 } },
    beta: { id: "beta", rule: "min", count: 1, members: ["shared"], children: [], allocation: { allocation_family: "cross-listed", max_uses: 1 } },
  };

  const allocation = allocateRequirementCourses(groups, {
    isCompleted: (courseId) => ["fallback", "shared"].includes(courseId),
  });

  assert.deepEqual(allocation.appliedByGroup, { alpha: ["fallback"], beta: ["shared"] });
  assert.equal(allocation.completedRequirements, 2);
});

test("exclusive allocation optimizes connected families together when a required parent depends on both", () => {
  const groups = {
    "a-required": { id: "a-required", rule: "all", members: ["shared"], children: ["z-child"], allocation: { allocation_family: "first-family", max_uses: 1 } },
    "b-optional": { id: "b-optional", rule: "min", count: 1, members: ["shared"], children: [], allocation: { allocation_family: "first-family", max_uses: 1 } },
    "z-child": { id: "z-child", rule: "min", count: 1, members: ["child-course"], children: [], allocation: { allocation_family: "second-family", max_uses: 1 } },
  };

  const allocation = allocateRequirementCourses(groups, {
    isCompleted: (courseId) => ["shared", "child-course"].includes(courseId),
  });

  assert.deepEqual(allocation.appliedByGroup, {
    "a-required": ["shared"],
    "b-optional": [],
    "z-child": ["child-course"],
  });
});

test("exclusive allocation prunes an impossible incomplete family with its stable result intact", () => {
  const sharedCourses = Array.from({ length: 20 }, (_, index) => `shared-${index}`);
  const groups = {
    alpha: { id: "alpha", rule: "min", count: 21, members: sharedCourses, children: [], allocation: { allocation_family: "large-family", max_uses: 1 } },
    beta: { id: "beta", rule: "min", count: 21, members: sharedCourses, children: [], allocation: { allocation_family: "large-family", max_uses: 1 } },
  };

  const allocation = allocateRequirementCourses(groups, {
    isCompleted: (courseId) => sharedCourses.includes(courseId),
  });

  assert.deepEqual(allocation.appliedByGroup, { alpha: [...sharedCourses].sort(), beta: [] });
  assert.equal(allocation.completedRequirements, 0);
});

test("exclusive allocation prunes individually feasible groups that exceed shared capacity", () => {
  const sharedCourses = Array.from({ length: 20 }, (_, index) => `shared-${index}`);
  const groups = {
    alpha: { id: "alpha", rule: "min", count: 11, members: sharedCourses, children: [], allocation: { allocation_family: "large-family", max_uses: 1 } },
    beta: { id: "beta", rule: "min", count: 11, members: sharedCourses, children: [], allocation: { allocation_family: "large-family", max_uses: 1 } },
  };

  const allocation = allocateRequirementCourses(groups, {
    isCompleted: (courseId) => sharedCourses.includes(courseId),
  });

  assert.equal(allocation.completedRequirements, 1);
  assert.equal(allocation.appliedByGroup.alpha.length, 20);
  assert.deepEqual(allocation.appliedByGroup.beta, []);
});
