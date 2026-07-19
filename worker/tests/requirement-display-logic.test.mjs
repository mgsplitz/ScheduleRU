import assert from "node:assert/strict";
import test from "node:test";

await import("../../requirement-group-logic.js");

const { requirementsForDisplay, sharedRequirementGroups, sharedRequirementRootKey } = globalThis.ScheduleRURequirementLogic;

function root(id, family = null, priority = 0, courses = []) {
  return { id, name: id, display_family: family, display_priority: priority, courses, children: [] };
}

test("a higher-priority shared requirement variant replaces a generic variant", () => {
  const selected = requirementsForDisplay({
    finance: [root("finance-core", "rbsnb-business-core", 10)],
    accounting: [root("accounting-core", "rbsnb-business-core", 100)],
  }, ["finance", "accounting"], (item) => item.id);
  assert.deepEqual(selected.map((item) => item.id), ["accounting-core"]);
});

test("a shared requirement family remains singular regardless of program order", () => {
  const selected = requirementsForDisplay({
    accounting: [root("accounting-core", "rbsnb-business-core", 100)],
    supply: [root("supply-core", "rbsnb-business-core", 10)],
  }, ["accounting", "supply"], (item) => item.id);
  assert.deepEqual(selected.map((item) => item.id), ["accounting-core"]);
});

test("identical roots without a display family are still de-duplicated", () => {
  const shared = root("same", null, 0, [{ course_code: "33:000:101" }]);
  const selected = requirementsForDisplay({ one: [shared], two: [shared] }, ["one", "two"], (item) => JSON.stringify(item));
  assert.equal(selected.length, 1);
});

test("unrelated requirement roots remain visible alongside a shared family", () => {
  const selected = requirementsForDisplay({
    accounting: [root("accounting-core", "rbsnb-business-core", 100), root("accounting-required")],
    finance: [root("finance-core", "rbsnb-business-core", 10), root("finance-required")],
  }, ["accounting", "finance"], (item) => item.id);
  assert.deepEqual(selected.map((item) => item.id), ["accounting-core", "accounting-required", "finance-required"]);
});

test("shared display families are excluded from cross-program overlap checks even when their course lists differ", () => {
  const trees = {
    accounting: [root("accounting-core", "rbsnb-business-core", 100, [{ course_code: "33:010:458" }])],
    finance: [root("finance-core", "rbsnb-business-core", 10, [{ course_code: "33:136:370" }])],
  };
  const shared = sharedRequirementGroups(trees, ["accounting", "finance"], (item) => item.id);
  assert.deepEqual(shared.map((item) => item.name), ["accounting-core"]);
  assert.equal(sharedRequirementRootKey(trees.accounting[0], (item) => item.id), "family:rbsnb-business-core");
  assert.equal(sharedRequirementRootKey(trees.finance[0], (item) => item.id), "family:rbsnb-business-core");
});
