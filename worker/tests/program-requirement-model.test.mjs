import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../packages/requirements/src/requirement-group-logic.js");

const moduleUrl = new URL(
  "../../packages/requirements/src/program-requirement-model.js",
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

const plain = (value) => JSON.parse(JSON.stringify(value));
const model = () => {
  assert.ok(
    context.globalThis.ScheduleRUProgramRequirementModel,
    "program-requirement-model.js must expose ScheduleRUProgramRequirementModel",
  );
  return context.globalThis.ScheduleRUProgramRequirementModel;
};
const course = (code) => ({ course_code: code });
const root = ({ id, name, courses, family = null, priority = 0 }) => ({
  id,
  name,
  rule: "all",
  count: null,
  display_family: family,
  display_priority: priority,
  courses: courses.map(course),
  course_selectors: [],
  children: [],
});

test("root signatures ignore presentation order but preserve reviewed selector meaning", () => {
  const first = root({ id: "one", name: "  Business   Core ", courses: ["33:620:301", "33:630:301"] });
  first.course_selectors = [
    { selector_json: '{"subject":"620"}' },
    { selector_json: '{"subject":"630"}' },
  ];
  const reordered = root({ id: "two", name: "business core", courses: ["33:630:301", "33:620:301"] });
  reordered.course_selectors = [...first.course_selectors].reverse();
  const changed = { ...reordered, course_selectors: [{ selector_json: '{"subject":"390"}' }] };

  assert.equal(model().rootSignature(first), model().rootSignature(reordered));
  assert.notEqual(model().rootSignature(first), model().rootSignature(changed));
});

test("shared business Core normalization separates only true program additions", () => {
  const sharedCodes = ["33:010:272", "33:136:370", "33:390:300", "33:620:301"];
  const financeCore = root({
    id: "finance-core",
    name: "Business Core",
    courses: [...sharedCodes, "33:390:380"],
  });
  const accountingCore = root({
    id: "accounting-core",
    name: "Business Core",
    courses: [...sharedCodes, "33:010:458"],
  });
  const financeRequired = root({
    id: "finance-required",
    name: "Finance Required",
    courses: ["33:390:380"],
  });
  const requirementTrees = {
    finance: [financeCore, financeRequired],
    accounting: [accountingCore],
  };
  const before = JSON.stringify(requirementTrees);

  const normalized = plain(model().normalizeProgramTrees({
    requirementTrees,
    programIds: ["finance", "accounting"],
    referenceRequirementTrees: requirementTrees,
    availablePrograms: [
      { id: "finance", name: "Finance" },
      { id: "accounting", name: "Accounting" },
    ],
  }));

  assert.equal(JSON.stringify(requirementTrees), before);
  assert.deepEqual(normalized.finance.map((item) => item.id), [
    "finance-core-shared-base",
    "finance-required",
  ]);
  assert.deepEqual(normalized.finance[0].courses.map((item) => item.course_code), sharedCodes);
  assert.deepEqual(normalized.accounting.map((item) => item.id), [
    "accounting-core-shared-base",
    "accounting-core-program-additions",
  ]);
  assert.equal(normalized.accounting[1].name, "Accounting-specific additions to Business Core");
  assert.deepEqual(normalized.accounting[1].courses, [course("33:010:458")]);
});

test("display roots deduplicate reviewed families and retain every owning program", () => {
  const finance = root({
    id: "finance-core",
    name: "Business Core",
    courses: ["33:010:272"],
    family: "rbs-business-core",
    priority: 10,
  });
  const accounting = root({
    id: "accounting-core",
    name: "Business Core",
    courses: ["33:010:272"],
    family: "rbs-business-core",
    priority: 100,
  });

  const displayed = plain(model().requirementsForDisplay({
    requirementTrees: { finance: [finance], accounting: [accounting] },
    programIds: ["finance", "accounting"],
  }));
  assert.equal(displayed.length, 1);
  assert.equal(displayed[0].id, "accounting-core");
  assert.deepEqual(displayed[0].sourceProgramIds, ["finance", "accounting"]);
  assert.equal(finance.sourceProgramIds, undefined);
  assert.equal(accounting.sourceProgramIds, undefined);
});

test("double-count analysis excludes shared families and enforces the matching program scope", () => {
  const sharedFinance = root({
    id: "finance-core",
    name: "Business Core",
    courses: ["33:010:272"],
    family: "rbs-business-core",
  });
  const sharedAccounting = root({
    id: "accounting-core",
    name: "Business Core",
    courses: ["33:010:272"],
    family: "rbs-business-core",
  });
  const result = plain(model().computeDoubleCount({
    requirementTrees: {
      finance: [sharedFinance, root({ id: "finance-elective", name: "Finance Elective", courses: ["33:390:380"] })],
      accounting: [sharedAccounting, root({ id: "accounting-elective", name: "Accounting Elective", courses: ["33:390:380"] })],
    },
    programIds: ["finance", "accounting"],
    availablePrograms: [
      { id: "finance", type: "major" },
      { id: "accounting", type: "major" },
    ],
    doubleCountExceptions: [],
    doubleCountPolicies: [{ scope: "major_major", max_shared_courses: 0 }],
  }));

  assert.deepEqual(result.overlaps, [{ code: "33:390:380", programs: ["finance", "accounting"] }]);
  assert.deepEqual(result.scopeResults[0], {
    scope: "major_major",
    policy: { scope: "major_major", max_shared_courses: 0 },
    codes: [{ code: "33:390:380", programs: ["accounting", "finance"] }],
    cap: 0,
    violates: true,
  });
  assert.deepEqual(result.scopeResults[1], {
    scope: "major_concentration",
    codes: [],
    cap: null,
    violates: false,
  });
  assert.deepEqual(result.unscoped, []);
});
