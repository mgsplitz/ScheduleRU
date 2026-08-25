import assert from "node:assert/strict";
import test from "node:test";

import { compileCourseRules } from "../src/course-rule-compiler.ts";

test("compiles a prerequisite and junior standing from separate official facts", () => {
  const result = compileCourseRules({
    code: "33:390:440",
    catalogPrereqs: "33:390:400 CORPORATE FINANCE",
    catalogRestrictions: "FINANCE MAJORS ONLY; JUNIORS AND SENIORS",
  });

  assert.deepEqual(result.prerequisitePaths, [["33:390:400"]]);
  assert.deepEqual(result.enforceablePrerequisitePaths, [["33:390:400"]]);
  assert.equal(result.minimumPlanYear, 3);
  assert.equal(result.ruleCoverage, "catalog_parsed");
});

test("preserves Brain-Inspired Computing prerequisite alternatives", () => {
  const result = compileCourseRules({
    code: "01:198:425",
    catalogPrereqs: "((01:198:206 INTRODUCTION TO DISCRETE STRUCTURES II or 01:640:477 MATHEMATICAL THEORY OF PROBABILITY) and (01:640:152 CALCULUS II FOR MATHEMATICAL AND PHYSICAL SCIENCES))",
  });

  assert.deepEqual(result.prerequisitePaths, [
    ["01:198:206", "01:640:152"],
    ["01:640:477", "01:640:152"],
  ]);
});

test("a reviewed directed substitution expands every matching prerequisite path", () => {
  const result = compileCourseRules({
    code: "01:198:999",
    catalogPrereqs: "01:198:206 INTRODUCTION TO DISCRETE STRUCTURES II and 01:640:152 CALCULUS II",
    prerequisiteSubstitutions: [{
      required_course_code: "01:198:206",
      satisfying_course_code: "01:640:477",
      review_status: "reviewed",
    }],
  });

  assert.deepEqual(result.prerequisitePaths, [
    ["01:198:206", "01:640:152"],
    ["01:640:477", "01:640:152"],
  ]);
});

test("keeps only New Brunswick Differential Equations alternatives", () => {
  const result = compileCourseRules({
    code: "01:640:252",
    catalogPrereqs: "((01:640:251 MULTIVARIABLE CALCULUS or 01:640:291 HONORS CALCULUS III or 21:640:235 CALCULUS III) and (01:640:250 INTRO LINEAR ALGEBRA)) OR ((50:640:221 CALCULUS III) and (50:640:250 LINEAR ALGEBRA))",
  });

  assert.deepEqual(result.prerequisitePaths, [
    ["01:640:251", "01:640:250"],
    ["01:640:291", "01:640:250"],
  ]);
});

test("discards impossible self-referential catalog prerequisite alternatives", () => {
  const result = compileCourseRules({
    code: "01:640:350",
    catalogPrereqs: "(01:640:250 and 01:640:300 and 01:640:251) OR (01:640:350 and 01:640:300 and 01:640:291)",
  });

  assert.deepEqual(result.prerequisitePaths, [
    ["01:640:250", "01:640:300", "01:640:251"],
  ]);
});

test("does not interpret conjunctions inside course titles as grammar", () => {
  const result = compileCourseRules({
    code: "01:999:401",
    catalogPrereqs: "01:640:136 CALCULUS II FOR THE LIFE AND SOCIAL SCIENCES and 01:960:285 INTRODUCTORY STATISTICS FOR BUSINESS",
  });

  assert.deepEqual(result.prerequisitePaths, [["01:640:136", "01:960:285"]]);
});

test("does not turn an equal-or-greater placement threshold into an exact prerequisite course", () => {
  const result = compileCourseRules({
    code: "01:640:250",
    catalogPrereqs: "Any Course EQUAL or GREATER Than: 01:640:112 PRECALCULUS PART II",
  });

  assert.deepEqual(result.prerequisitePaths, []);
  assert.deepEqual(result.enforceablePrerequisitePaths, []);
});

test("reviewed conditions override catalog wording and carry exclusion families", () => {
  const result = compileCourseRules({
    code: "01:640:252",
    catalogPrereqs: "01:640:251 MULTIVARIABLE CALCULUS",
    reviewedEligibility: {
      review: { course_code: "01:640:252", review_status: "reviewed", no_known_conditions: 0 },
      conditions: [{
        condition_type: "prerequisite_course",
        condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:250"] }),
        review_status: "reviewed",
      }],
      credit_exclusions: [{ policy_key: "rutgers-nb-differential-equations-credit" }],
    },
  });

  assert.deepEqual(result.prerequisitePaths, [["01:640:250"]]);
  assert.deepEqual(result.creditExclusionFamilies, ["rutgers-nb-differential-equations-credit"]);
  assert.equal(result.ruleCoverage, "reviewed");
});

test("an official catalog record with no listed rules is a complete no-condition fact", () => {
  const result = compileCourseRules({
    code: "01:730:103",
    catalogRecordAvailable: true,
    catalogPrereqs: "",
    catalogRestrictions: "",
  });

  assert.deepEqual(result.prerequisitePaths, []);
  assert.equal(result.ruleCoverage, "catalog_parsed");
});

test("official requirement notes supply prerequisite paths when the catalog archive is empty", () => {
  const result = compileCourseRules({
    code: "33:136:487",
    catalogRecordAvailable: true,
    catalogPrereqs: "",
    requirementNotes: ["pre-reqs: 33:136:370 or 33:010:458"],
  });

  assert.deepEqual(result.prerequisitePaths, [
    ["33:136:370"],
    ["33:010:458"],
  ]);
  assert.equal(result.ruleCoverage, "catalog_parsed");
});
