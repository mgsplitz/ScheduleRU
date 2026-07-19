import assert from "node:assert/strict";
import test from "node:test";

await import("../../requirement-group-logic.js");

const { groupFulfilled } = globalThis.ScheduleRURequirementLogic;

function evaluate(groups, completed) {
  const taken = new Set(completed);
  return (groupId) => groupFulfilled(groupId, groups, {
    isCompleted: (courseId) => taken.has(courseId),
    selectedRequirementCourses: () => [],
    isConstraintGroup: (group) => {
      const parent = groups[group?.parentId];
      if (!parent || parent.rule === "distinct" || !(group?.members || []).length || !(parent.members || []).length) return false;
      const parentMembers = new Set(parent.members);
      return group.members.every((courseId) => parentMembers.has(courseId));
    },
  });
}

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
