import assert from "node:assert/strict";
import test from "node:test";

await import("../../academic-credit-logic.js");

const logic = globalThis.ScheduleRUAcademicCredit;

function tree(courses) {
  return { courses };
}

test("compact Rutgers requirement IDs normalize to prerequisite-ready course codes", () => {
  assert.equal(logic.normalizeCourseCode("01640135"), "01:640:135");
  assert.equal(logic.normalizeCourseCode("01:640:151"), "01:640:151");
  assert.equal(logic.normalizeCourseCode("bad"), "");
  assert.deepEqual([...logic.satisfiedCourseCodes({
    confirmedCourseCodes: ["01640135", "01:640:151"],
  })].sort(), ["01:640:135", "01:640:151"]);
});

test("reviewed alternatives close transitively across every loaded requirement tree", () => {
  const result = logic.satisfiedCourseCodes({
    confirmedCourseCodes: ["01:198:111"],
    requirementTrees: [
      tree({
        businessComputer: {
          code: "01:198:170",
          alternatives: [{ code: "01:198:110" }, { code: "01:198:111" }],
        },
      }),
      tree({
        downstreamRequirement: {
          code: "33:136:370",
          alternatives: [{ code: "01:198:170" }],
        },
      }),
    ],
  });

  assert.deepEqual([...result].sort(), ["01:198:111", "01:198:170", "33:136:370"]);
});

test("planned course entries expose reviewed equivalents without duplicating credits", () => {
  const result = logic.expandedPlannedCourseEntries({
    entries: [{
      id: "scheduled:intro-cs",
      course_code: "01:198:111",
      credits: 4,
      year: 1,
      sem: "fall",
    }],
    requirementTrees: [
      tree({
        businessComputer: {
          code: "01:198:170",
          alternatives: [{ code: "01:198:111" }],
        },
      }),
    ],
  });

  assert.deepEqual(result.map((entry) => ({
    course_code: entry.course_code,
    credits: entry.credits,
    year: entry.year,
    sem: entry.sem,
  })), [
    { course_code: "01:198:111", credits: 4, year: 1, sem: "fall" },
    { course_code: "01:198:170", credits: 0, year: 1, sem: "fall" },
  ]);
  assert.equal(result.reduce((total, entry) => total + entry.credits, 0), 4);
});

test("an alternative satisfies only its canonical reviewed requirement", () => {
  const result = logic.satisfiedCourseCodes({
    confirmedCourseCodes: ["01:960:211"],
    requirementTrees: [
      tree({
        businessStatistics: {
          code: "01:960:285",
          alternatives: [{ equivalent_course_code: "01:960:211" }],
        },
        unrelatedStatistics: {
          code: "01:960:401",
          alternatives: [],
        },
      }),
    ],
  });

  assert.deepEqual([...result].sort(), ["01:960:211", "01:960:285"]);
});

test("simultaneously planned reviewed alternatives make only their canonical courses redundant", () => {
  const result = logic.redundantCanonicalCourseCodes({
    courseCodes: ["01:198:111", "01:198:170", "33:136:385"],
    requirementTrees: [
      tree({
        businessComputer: {
          code: "01:198:170",
          alternatives: [{ code: "01:198:111" }],
        },
        statisticalMethods: {
          code: "33:136:385",
          alternatives: [],
        },
      }),
    ],
  });

  assert.deepEqual([...result], ["01:198:170"]);
});

test("malformed codes and unreviewed prose do not create equivalencies", () => {
  const result = logic.satisfiedCourseCodes({
    confirmedCourseCodes: ["01:198:111", "not-a-course"],
    requirementTrees: [
      tree({
        businessComputer: {
          code: "01:198:170",
          requirementNotes: ["An advisor may approve another computer course."],
          alternatives: [{ code: "bad" }],
        },
      }),
    ],
  });

  assert.deepEqual([...result], ["01:198:111"]);
});
