import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../packages/planner/src/eligibility-logic.js");

const moduleUrl = new URL("../../packages/planner/src/course-path-model.js", import.meta.url);
const context = {
  globalThis: {
    ScheduleRUEligibilityLogic: globalThis.ScheduleRUEligibilityLogic,
  },
};
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function coursePaths() {
  assert.ok(
    context.globalThis.ScheduleRUCoursePathModel,
    "course-path-model.js must expose ScheduleRUCoursePathModel",
  );
  return context.globalThis.ScheduleRUCoursePathModel;
}
const plain = (value) => JSON.parse(JSON.stringify(value));

function createModel({ coursesById = {}, eligibilityByCode = {}, confirmed = [], scheduled = [] } = {}) {
  const coursesByCode = Object.fromEntries(
    Object.values(coursesById).filter((course) => course?.code).map((course) => [course.code, course]),
  );
  return coursePaths().create({
    getCourseById: (id) => coursesById[id] || null,
    getCourseByCode: (code) => coursesByCode[code] || null,
    getEligibilityForCourse: (course) => course?.eligibility || eligibilityByCode[course?.code] || null,
    getConfirmedCourseCodes: () => confirmed,
    getScheduledEntries: () => scheduled,
  });
}

test("reviewed prerequisite conditions take precedence over requirement and catalog fallbacks", () => {
  const model = createModel({
    coursesById: {
      direct: { code: "01:198:110", title: "Legacy Introduction" },
      reviewed: { code: "01:198:111", fullTitle: "Introduction to Computer Science" },
    },
  });
  const course = {
    code: "01:198:112",
    prereqs: ["direct"],
    catalogPrereqs: "01:640:151 Calculus I",
    eligibility: {
      review: { course_code: "01:198:112", review_status: "reviewed", no_known_conditions: 0 },
      conditions: [{
        review_status: "reviewed",
        condition_type: "prerequisite_course",
        condition_value_json: { any_of_course_codes: ["01:198:111"] },
      }],
    },
  };

  assert.deepEqual(plain(model.planForCourse(course)), {
    reviewable: true,
    paths: [["01:198:111"]],
    references: [
      { course_code: "01:640:151", title: "Calculus I" },
      { course_code: "01:198:110", title: "Legacy Introduction" },
      { course_code: "01:198:111", title: "Introduction to Computer Science" },
    ],
    source: "reviewed_conditions",
    verifiedNoPrerequisites: false,
  });
});

test("requirement-tree prerequisites form one complete path when reviewed conditions are absent", () => {
  const model = createModel({
    coursesById: {
      first: { code: "01:198:111", title: "Introduction" },
      second: { code: "01:640:151", title: "Calculus I" },
    },
  });
  const plan = model.planForCourse({
    code: "01:198:205",
    prereqs: ["first", "second", "missing"],
    catalogPrereqs: "",
  });

  assert.equal(plan.source, "reviewed_simple");
  assert.deepEqual(plain(plan.paths), [["01:198:111", "01:640:151"]]);
  assert.deepEqual(plain(plan.references), [
    { course_code: "01:198:111", title: "Introduction" },
    { course_code: "01:640:151", title: "Calculus I" },
  ]);
});

test("safe catalog alternatives stay distinct while unsupported wording remains advisory", () => {
  const model = createModel();
  const safe = model.planForCourse({
    code: "01:198:205",
    catalogPrereqs: "01:198:111 Introduction or 01:198:112 Data Structures",
  });
  const advisory = model.planForCourse({
    code: "01:198:206",
    catalogPrereqs: "01:198:111 Introduction and permission of instructor",
  });

  assert.equal(safe.source, "catalog");
  assert.deepEqual(plain(safe.paths), [["01:198:111"], ["01:198:112"]]);
  assert.equal(advisory.source, "catalog_unreviewed");
  assert.deepEqual(plain(advisory.paths), []);
  assert.deepEqual(plain(advisory.references), [
    { course_code: "01:198:111", title: "Introduction and permission of instructor" },
  ]);
});

test("term evaluation distinguishes completed, earlier, same-term, and later prerequisites", () => {
  const model = createModel({
    coursesById: { intro: { code: "01:198:111", title: "Introduction" } },
    confirmed: [],
    scheduled: [{ course_code: "01:198:111", year: 2, sem: "spring" }],
  });
  const course = { code: "01:198:205", prereqs: ["intro"] };

  assert.equal(model.eligibilityForTerm(course, { year: 2, sem: "fall" }).status, "blocked");
  assert.equal(
    model.eligibilityForTerm(course, { year: 2, sem: "spring" }).paths[0].courseStates[0].state,
    "same_term",
  );
  assert.equal(model.eligibilityForTerm(course, { year: 3, sem: "fall" }).status, "planned_assumption");

  const completedModel = createModel({
    coursesById: { intro: { code: "01:198:111", title: "Introduction" } },
    confirmed: ["01:198:111"],
  });
  assert.equal(completedModel.eligibilityForTerm(course, { year: 1, sem: "fall" }).status, "eligible_now");
});
