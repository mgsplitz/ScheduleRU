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
