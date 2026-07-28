import assert from "node:assert/strict";
import test from "node:test";

await import("../../eligibility-logic.js");

const logic = globalThis.ScheduleRUEligibilityLogic;
const review = { course_code: "01:999:450", review_status: "reviewed", no_known_conditions: 0 };
const creditGate = {
  condition_type: "minimum_prior_credits",
  condition_value_json: JSON.stringify({ minimum_credits: 45 }),
  review_status: "reviewed",
};

test("term ordering accepts only fall and spring planner terms", () => {
  assert.equal(logic.termOrdinal({ year: 1, sem: "fall" }), 0);
  assert.equal(logic.termOrdinal({ year: 1, sem: "spring" }), 1);
  assert.equal(logic.termOrdinal({ year: 2, sem: "fall" }), 2);
  assert.equal(logic.termOrdinal({ year: 0, sem: "fall" }), null);
  assert.equal(logic.termOrdinal({ year: 1, sem: "summer" }), null);
});

test("44 confirmed credits do not meet a reviewed 45-credit gate", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review, conditions: [creditGate],
    confirmedEntries: [{ id: "ap:one", source: "ap", credits: 44 }], scheduledEntries: [],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.missing[0].type, "minimum_prior_credits");
  assert.equal(result.creditTotals.confirmed, 44);
});

test("45 accepted AP and transfer credits meet a reviewed gate", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review, conditions: [creditGate],
    confirmedEntries: [
      { id: "ap:physics", source: "ap", credits: 20 },
      { id: "transfer:calc", source: "transfer", credits: 25 },
    ], scheduledEntries: [],
  });
  assert.equal(result.status, "eligible_now");
  assert.equal(result.creditTotals.confirmed, 45);
});

test("same-term planned credits cannot unlock a course, but earlier planned credits can", () => {
  const scheduled = [{
    id: "scheduled:calc", course_code: "01:640:250", credits: 15, year: 2, sem: "fall",
  }];
  const sameTerm = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "plan", review, conditions: [creditGate],
    confirmedEntries: [{ id: "ap", source: "ap", credits: 30 }], scheduledEntries: scheduled,
  });
  const laterTerm = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "spring" }, mode: "plan", review, conditions: [creditGate],
    confirmedEntries: [{ id: "ap", source: "ap", credits: 30 }], scheduledEntries: scheduled,
  });
  assert.equal(sameTerm.status, "blocked");
  assert.equal(laterTerm.status, "planned_assumption");
  assert.equal(laterTerm.creditTotals.planned, 15);
});

const prerequisiteGate = {
  condition_type: "prerequisite_course",
  condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:250"] }),
  review_status: "reviewed",
};

const corequisiteGate = {
  condition_type: "corequisite_course",
  condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:250"] }),
  review_status: "reviewed",
};

test("an earlier planned prerequisite unlocks only a later term", () => {
  const scheduled = [{ id: "scheduled:calc", course_code: "01:640:250", credits: 4, year: 2, sem: "fall" }];
  const sameTerm = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "plan", review, conditions: [prerequisiteGate],
    confirmedEntries: [], scheduledEntries: scheduled,
  });
  const laterTerm = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "spring" }, mode: "plan", review, conditions: [prerequisiteGate],
    confirmedEntries: [], scheduledEntries: scheduled,
  });
  assert.equal(sameTerm.status, "blocked");
  assert.equal(laterTerm.status, "planned_assumption");
});

test("a reviewed co-requisite permits a matching same-term course", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "plan", review, conditions: [corequisiteGate],
    confirmedEntries: [],
    scheduledEntries: [{ id: "scheduled:calc", course_code: "01:640:250", credits: 4, year: 2, sem: "fall" }],
  });
  assert.equal(result.status, "eligible_now");
});

test("one AP award satisfies every official course equivalent without double-counting credit", () => {
  const calculusOne = {
    condition_type: "prerequisite_course",
    condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:151"] }),
    review_status: "reviewed",
  };
  const calculusTwo = {
    condition_type: "prerequisite_course",
    condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:152"] }),
    review_status: "reviewed",
  };
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review,
    conditions: [calculusOne, calculusTwo],
    confirmedEntries: [{
      id: "ap:calc-bc", source: "ap", credits: 8, course_code: "01:640:151",
      equivalent_course_codes: ["01:640:151", "01:640:152"],
    }],
    scheduledEntries: [],
  });
  assert.equal(result.status, "eligible_now");
  assert.equal(result.creditTotals.confirmed, 8);
});

test("wishlist-shaped records do not add credit", () => {
  const result = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current", review, conditions: [creditGate],
    confirmedEntries: [{ id: "wishlist:course", source: "wishlist", credits: 100 }], scheduledEntries: [],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.creditTotals.confirmed, 0);
});

test("only an explicit reviewed no-condition marker is eligible without conditions", () => {
  const reviewedNoConditions = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current",
    review: { ...review, no_known_conditions: 1 }, conditions: [], confirmedEntries: [], scheduledEntries: [],
  });
  const unreviewed = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "fall" }, mode: "current",
    review: { ...review, review_status: "draft" }, conditions: [], confirmedEntries: [], scheduledEntries: [],
  });
  assert.equal(reviewedNoConditions.status, "eligible_now");
  assert.equal(unreviewed.status, "needs_review");
});

test("a reviewed plan-year condition blocks courses before the required year", () => {
  const juniorGate = {
    condition_type: "minimum_plan_year",
    condition_value_json: JSON.stringify({ minimum_year: 3 }),
    review_status: "reviewed",
  };
  const early = logic.evaluateEligibility({
    targetTerm: { year: 2, sem: "spring" }, mode: "plan", review, conditions: [juniorGate],
    confirmedEntries: [], scheduledEntries: [],
  });
  const junior = logic.evaluateEligibility({
    targetTerm: { year: 3, sem: "fall" }, mode: "plan", review, conditions: [juniorGate],
    confirmedEntries: [], scheduledEntries: [],
  });
  assert.equal(early.status, "blocked");
  assert.equal(junior.status, "eligible_now");
});

test("catalog prerequisite paths preserve OR alternatives instead of flattening them", () => {
  const parsed = logic.parseCatalogPrerequisitePaths(
    "(33:010:272 INTRODUCTION TO FINANCIAL ACCOUNTING and 01:220:103 INTRODUCTION TO MACROECONOMICS and 01:960:285 INTRODUCTORY STATISTICS FOR BUSINESS) OR (33:010:272 INTRODUCTION TO FINANCIAL ACCOUNTING and 01:220:103 INTRODUCTION TO MACROECONOMICS and 01:960:211 STATISTICS I)"
  );
  assert.equal(parsed.reviewable, true);
  assert.deepEqual(parsed.paths, [
    ["33:010:272", "01:220:103", "01:960:285"],
    ["33:010:272", "01:220:103", "01:960:211"],
  ]);
});

test("course-title conjunctions do not become prerequisite operators", () => {
  const parsed = logic.parseCatalogPrerequisitePaths(
    "(01:220:320 INTERMEDIATE MICROECONOMIC ANALYSIS and 01:220:321 INTERMEDIATE MACROECONOMIC ANALYSIS and 01:220:322 ECONOMETRICS and 01:640:136 CALCULUS II FOR THE LIFE AND SOCIAL SCIENCES) OR (01:220:320 INTERMEDIATE MICROECONOMIC ANALYSIS and 01:220:321 INTERMEDIATE MACROECONOMIC ANALYSIS and 01:220:322 ECONOMETRICS and 01:640:152 CALCULUS II FOR MATHEMATICAL AND PHYSICAL SCIENCES)"
  );
  assert.equal(parsed.reviewable, true);
  assert.deepEqual(parsed.paths, [
    ["01:220:320", "01:220:321", "01:220:322", "01:640:136"],
    ["01:220:320", "01:220:321", "01:220:322", "01:640:152"],
  ]);
});

test("catalog prerequisite eligibility requires courses in an earlier term, not merely somewhere in the plan", () => {
  const paths = [["01:220:320"]];
  const sameTerm = logic.evaluatePrerequisitePaths({
    targetTerm: { year: 2, sem: "fall" },
    paths,
    confirmedCourseCodes: [],
    scheduledEntries: [{ course_code: "01:220:320", year: 2, sem: "fall" }],
  });
  const earlierTerm = logic.evaluatePrerequisitePaths({
    targetTerm: { year: 2, sem: "spring" },
    paths,
    confirmedCourseCodes: [],
    scheduledEntries: [{ course_code: "01:220:320", year: 2, sem: "fall" }],
  });
  const laterTerm = logic.evaluatePrerequisitePaths({
    targetTerm: { year: 1, sem: "fall" },
    paths,
    confirmedCourseCodes: [],
    scheduledEntries: [{ course_code: "01:220:320", year: 2, sem: "fall" }],
  });
  assert.equal(sameTerm.status, "blocked");
  assert.equal(sameTerm.recommendedPath.missing[0].reason, "same_term");
  assert.equal(earlierTerm.status, "planned_assumption");
  assert.equal(laterTerm.status, "blocked");
  assert.equal(laterTerm.recommendedPath.missing[0].reason, "later_term");
});

test("unsupported catalog wording is displayed as references but is not incorrectly enforced", () => {
  const parsed = logic.parseCatalogPrerequisitePaths(
    "Any Course EQUAL or GREATER Than: (01:640:111 PRECALCULUS PART I)"
  );
  assert.equal(parsed.reviewable, false);
  assert.deepEqual(parsed.paths, []);
  assert.deepEqual(parsed.references, [{ course_code: "01:640:111", title: "PRECALCULUS PART I" }]);
});

test("reviewed prerequisite groups become complete alternative paths", () => {
  const paths = logic.prerequisitePathsFromConditions([
    {
      condition_type: "prerequisite_course",
      condition_value_json: JSON.stringify({ any_of_course_codes: ["01:960:211", "01:960:285"] }),
      review_status: "reviewed",
    },
    {
      condition_type: "prerequisite_course",
      condition_value_json: JSON.stringify({ any_of_course_codes: ["01:220:320"] }),
      review_status: "reviewed",
    },
  ]);
  assert.deepEqual(paths, [
    ["01:960:211", "01:220:320"],
    ["01:960:285", "01:220:320"],
  ]);
});
