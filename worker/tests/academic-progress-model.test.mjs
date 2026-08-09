import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../packages/requirements/src/academic-credit-logic.js");
await import("../../packages/planner/src/eligibility-logic.js");

const moduleUrl = new URL(
  "../../packages/planner/src/academic-progress-model.js",
  import.meta.url,
);
const context = {
  globalThis: {
    ScheduleRUAcademicCredit: globalThis.ScheduleRUAcademicCredit,
    ScheduleRUEligibilityLogic: globalThis.ScheduleRUEligibilityLogic,
  },
};
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

const academicProgress = () => {
  assert.ok(
    context.globalThis.ScheduleRUAcademicProgressModel,
    "academic-progress-model.js must expose ScheduleRUAcademicProgressModel",
  );
  return context.globalThis.ScheduleRUAcademicProgressModel;
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const courseCodesFromText = (text) => String(text || "").match(/\b\d{2}:\d{3}:\d{3}\b/g) || [];

test("credit values normalize numeric catalog labels and default missing amounts to zero", () => {
  assert.equal(academicProgress().creditNumber("4 credits"), 4);
  assert.equal(academicProgress().creditNumber("3.5 cr"), 3.5);
  assert.equal(academicProgress().creditNumber("up to 3 credits"), 3);
  assert.equal(academicProgress().creditNumber("unknown"), 0);
});

test("confirmed credit entries combine selected AP, completed courses, and reviewed ledger entries", () => {
  const state = {
    apOn: { calculus: true, ignored: false },
    completed: { "01198111": true, ignored: false },
    creditLedger: {
      transfer: {
        id: "transfer:one",
        source: "transfer",
        credits: 3,
        course_code: "01:220:102",
      },
    },
    schedule: {},
    courseEligibilityByCode: {},
  };
  const model = academicProgress().create({
    getState: () => state,
    getApAwards: () => [{
      id: "calculus",
      credits: "4 credits",
      equiv: "01:640:151 and 01:640:135",
      fulfills: ["01640135"],
    }],
    getRequirementTrees: () => [],
    courseRecordFromId: (id) => id === "01198111"
      ? { code: "01:198:111", credits: "4" }
      : null,
    courseCodesFromText,
  });

  assert.deepEqual(plain(model.confirmedCreditEntries()), [
    {
      id: "ap:calculus",
      source: "ap",
      credits: 4,
      course_code: "01:640:151",
      equivalent_course_codes: ["01:640:151", "01:640:135"],
    },
    {
      id: "completed:01198111",
      source: "rutgers_completed",
      credits: 4,
      course_code: "01:198:111",
      equivalent_course_codes: ["01:198:111"],
    },
    {
      id: "transfer:one",
      source: "transfer",
      credits: 3,
      course_code: "01:220:102",
      equivalent_course_codes: ["01:220:102"],
    },
  ]);
});

test("confirmed and scheduled alternatives close into canonical requirement courses", () => {
  const requirementTrees = [{
    courses: {
      intro: {
        code: "01:198:111",
        alternatives: [{ code: "01:198:110" }],
      },
    },
  }];
  const state = {
    apOn: {},
    completed: {},
    creditLedger: {},
    schedule: {
      alternative: {
        code: "01:198:110",
        credits: "4 credits",
        year: 1,
        sem: "fall",
      },
    },
    courseEligibilityByCode: {},
  };
  const model = academicProgress().create({
    getState: () => state,
    getApAwards: () => [],
    getRequirementTrees: () => requirementTrees,
    courseRecordFromId: () => null,
    courseCodesFromText,
  });
  const externalEntries = [{
    id: "manual:alternative",
    source: "manual_reviewed",
    credits: 4,
    course_code: "01:198:110",
    equivalent_course_codes: ["01:198:110"],
  }];

  assert.deepEqual(plain(model.confirmedCourseCodes(externalEntries)).sort(), [
    "01:198:110",
    "01:198:111",
  ]);
  assert.deepEqual(plain(model.scheduledCreditEntries()), [
    {
      id: "scheduled:01:198:110",
      course_code: "01:198:110",
      credits: 4,
      year: 1,
      sem: "fall",
    },
    {
      id: "scheduled:01:198:110:equivalent:01:198:111",
      course_code: "01:198:111",
      credits: 0,
      year: 1,
      sem: "fall",
      equivalent_of_course_code: "01:198:110",
    },
  ]);
});

test("eligibility evaluation accepts caller-augmented confirmed entries", () => {
  const state = {
    apOn: {}, completed: {}, creditLedger: {}, schedule: {}, courseEligibilityByCode: {},
  };
  const model = academicProgress().create({
    getState: () => state,
    getApAwards: () => [],
    getRequirementTrees: () => [],
    courseRecordFromId: () => null,
    courseCodesFromText,
  });
  const course = {
    code: "01:198:112",
    eligibility: {
      review: {
        course_code: "01:198:112",
        review_status: "reviewed",
        no_known_conditions: 0,
      },
      conditions: [{
        review_status: "reviewed",
        condition_type: "prerequisite_course",
        condition_value_json: { any_of_course_codes: ["01:198:111"] },
      }],
    },
  };
  const augmented = [{
    id: "manual:intro",
    source: "manual_reviewed",
    credits: 4,
    course_code: "01:198:111",
  }];

  assert.equal(
    model.eligibilityForTerm(course, { year: 1, sem: "spring" }).status,
    "blocked",
  );
  assert.equal(
    model.eligibilityForTerm(course, { year: 1, sem: "spring" }, {
      confirmedEntries: augmented,
      scheduledEntries: [],
    }).status,
    "eligible_now",
  );
  assert.equal(model.reviewedEligibility(course), course.eligibility);
});
