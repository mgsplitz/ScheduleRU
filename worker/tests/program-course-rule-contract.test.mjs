import assert from "node:assert/strict";
import test from "node:test";

import {
  compilePublicCourseRules,
  getReviewedPrerequisiteSubstitutions,
} from "../../apps/api/src/programs.js";

test("program API compiles its database row into the canonical academic-rule contract", () => {
  const rules = compilePublicCourseRules({
    course_code: "33:390:440",
    catalog_prereqs: "33:390:400 CORPORATE FINANCE",
    section_restrictions: "FINANCE MAJORS ONLY; JUNIORS AND SENIORS",
    note: "Finance elective",
    eligibility: null,
  });

  assert.deepEqual(rules.prerequisitePaths, [["33:390:400"]]);
  assert.equal(rules.minimumPlanYear, 3);
  assert.equal(rules.ruleCoverage, "catalog_parsed");
});

test("program API gives reviewed facts precedence over raw catalog text", () => {
  const rules = compilePublicCourseRules({
    course_code: "01:640:252",
    catalog_prereqs: "01:640:251 MULTIVARIABLE CALCULUS",
    eligibility: {
      review: { review_status: "reviewed", no_known_conditions: 0 },
      conditions: [{
        condition_type: "prerequisite_course",
        condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:250"] }),
        review_status: "reviewed",
      }],
      credit_exclusions: [{ policy_key: "rutgers-nb-differential-equations-credit" }],
    },
  });

  assert.deepEqual(rules.prerequisitePaths, [["01:640:250"]]);
  assert.deepEqual(rules.creditExclusionFamilies, ["rutgers-nb-differential-equations-credit"]);
  assert.equal(rules.ruleCoverage, "reviewed");
});

test("program API uses an official prerequisite note when archived catalog metadata is empty", () => {
  const rules = compilePublicCourseRules({
    course_code: "33:136:487",
    catalog_title: "LARGE-SCALE BUSINESS DATA ANALYSIS",
    catalog_prereqs: "",
    note: "pre-reqs: 33:136:370 or 33:010:458",
    eligibility: null,
  });

  assert.deepEqual(rules.prerequisitePaths, [
    ["33:136:370"],
    ["33:010:458"],
  ]);
});

test("program API compiles reviewed directed prerequisite substitutions", () => {
  const rules = compilePublicCourseRules({
    course_code: "01:198:999",
    catalog_title: "ADVANCED COMPUTER SCIENCE",
    catalog_prereqs: "01:198:206 INTRODUCTION TO DISCRETE STRUCTURES II",
  }, [{
    required_course_code: "01:198:206",
    satisfying_course_code: "01:640:477",
    review_status: "reviewed",
  }]);

  assert.deepEqual(rules.prerequisitePaths, [
    ["01:198:206"],
    ["01:640:477"],
  ]);
});

test("program API loads only reviewed directed prerequisite substitutions", async () => {
  const rows = [{
    required_course_code: "01:198:206",
    satisfying_course_code: "01:640:477",
    review_status: "reviewed",
  }];
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM course_prerequisite_substitutions/);
        assert.match(sql, /review_status = 'reviewed'/);
        return {
          bind() { return this; },
          async all() { return { results: rows }; },
        };
      },
    },
  };

  assert.deepEqual(await getReviewedPrerequisiteSubstitutions(env), rows);
});
