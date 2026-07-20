import assert from "node:assert/strict";
import test from "node:test";

await import("../../course-selector-logic.js");

const selectors = globalThis.ScheduleRUCourseSelectorLogic;

test("a finite reviewed course-code selector accepts only its approved codes", () => {
  const selector = {
    version: 1,
    kind: "course_codes",
    include_course_codes: ["01:790:300", "01:790:301"],
  };
  assert.equal(selectors.matchesSelector("01:790:300", selector), true);
  assert.equal(selectors.matchesSelector("29:790:300", selector), false);
  assert.equal(selectors.matchesSelector("01:790:302", selector), false);
});

test("a subject-and-level selector keeps its reviewed campus and numeric range", () => {
  const selector = {
    version: 1,
    kind: "subject_level",
    school_codes: ["01"],
    subject_codes: ["790"],
    course_number_min: 300,
    course_number_max: 499,
  };
  assert.equal(selectors.matchesSelector("01:790:300", selector), true);
  assert.equal(selectors.matchesSelector("01:790:499", selector), true);
  assert.equal(selectors.matchesSelector("01:790:299", selector), false);
  assert.equal(selectors.matchesSelector("29:790:300", selector), false);
  assert.equal(selectors.matchesSelector("01:198:300", selector), false);
});

test("a reviewed selector excludes source-disallowed courses inside its range", () => {
  const selector = {
    version: 1,
    kind: "subject_level",
    school_codes: ["01"],
    subject_codes: ["640"],
    course_number_min: 300,
    course_number_max: 499,
    exclude_course_codes: ["01:640:491", "01:640:492"],
  };
  assert.equal(selectors.matchesSelector("01:640:490", selector), true);
  assert.equal(selectors.matchesSelector("01:640:491", selector), false);
  assert.equal(selectors.matchesSelector("01:640:492", selector), false);
});

test("unknown or malformed selectors fail closed", () => {
  assert.equal(selectors.matchesSelector("01:790:300", { version: 1, kind: "department" }), false);
  assert.equal(selectors.matchesSelector("01:790:300", {
    version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["790"], course_number_min: 500, course_number_max: 300,
  }), false);
  assert.equal(selectors.matchesSelector("01:790:300", { version: 2, kind: "course_codes", include_course_codes: ["01:790:300"] }), false);
});

test("selector subset checks prove only safe nested relationships", () => {
  const parent = { version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["790"], course_number_min: 300, course_number_max: 499 };
  const child = { version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["790"], course_number_min: 400, course_number_max: 499 };
  assert.equal(selectors.selectorIsSubset(child, parent), true);
  assert.equal(selectors.selectorIsSubset(parent, child), false);
  assert.equal(selectors.selectorIsSubset({ version: 1, kind: "course_codes", include_course_codes: ["29:790:300"] }, parent), false);
});
