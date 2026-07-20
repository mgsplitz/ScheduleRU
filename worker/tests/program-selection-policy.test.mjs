import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluateProgramSelection, publicEligibilityRule } from "../src/program-selection-policy.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../fixtures/program-selection-comparison-cases.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

for (const comparisonCase of fixture.cases) {
  test(comparisonCase.id, () => {
    const result = evaluateProgramSelection({
      homeSchoolSlug: fixture.policy_snapshot.home_school_slug,
      selectedProgramIds: comparisonCase.selected_program_ids,
      programs: fixture.programs,
      limits: fixture.policy_snapshot.limits,
      combinationPolicies: fixture.policy_snapshot.combination_policies,
      eligibilityRules: comparisonCase.eligibility_rules || [],
    });
    assert.equal(result.allowed, comparisonCase.expected.allowed);
    assert.deepEqual(result.errors.map((issue) => issue.code).sort(), [...comparisonCase.expected.error_codes].sort());
  });
}

test("unknown program ids are rejected instead of being silently dropped", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: fixture.policy_snapshot.home_school_slug,
    selectedProgramIds: ["rbsnb-bait", "not-a-reviewed-program"],
    programs: fixture.programs,
    limits: fixture.policy_snapshot.limits,
    combinationPolicies: fixture.policy_snapshot.combination_policies,
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), ["unknown_program"]);
});

test("an RBS-only home-school rule blocks the RBS Business Administration minor", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-business-administration-minor"],
    programs: fixture.programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "rbsnb-ba-minor-non-rbs-only",
      program_id: "rbsnb-business-administration-minor",
      condition_type: "home_school_must_not_be_one_of",
      condition_value_json: '["rbsnb"]',
      decision: "blocked",
      note: "The Business Administration minor is for non-RBS students.",
    }],
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), ["eligibility:rbsnb-ba-minor-non-rbs-only"]);
});

test("a named major exclusion blocks a BAIT student from the Business Analytics concentration", () => {
  const programs = [...fixture.programs, {
    id: "rbsnb-business-analytics-concentration", school_slug: "rbsnb", type: "concentration",
  }];
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-bait", "rbsnb-business-analytics-concentration"],
    programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "rbsnb-business-analytics-concentration-no-bait",
      program_id: "rbsnb-business-analytics-concentration",
      condition_type: "selected_program_must_not_include_any",
      condition_value_json: '["rbsnb-bait"]',
      decision: "blocked",
      note: "BAIT majors may not declare this concentration.",
    }],
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), ["eligibility:rbsnb-business-analytics-concentration-no-bait"]);
});

test("a Leadership and Management major cannot add the Leadership Skills concentration", () => {
  const programs = [...fixture.programs,
    { id: "rbsnb-leadership-management", school_slug: "rbsnb", type: "major" },
    { id: "rbsnb-leadership-skills-concentration", school_slug: "rbsnb", type: "concentration" },
  ];
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-leadership-management", "rbsnb-leadership-skills-concentration"],
    programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "rbsnb-leadership-skills-concentration-no-lm",
      program_id: "rbsnb-leadership-skills-concentration",
      condition_type: "selected_program_must_not_include_any",
      condition_value_json: '["rbsnb-leadership-management"]',
      decision: "blocked",
      note: "Leadership and Management majors may not declare the Leadership Skills concentration.",
    }],
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), ["eligibility:rbsnb-leadership-skills-concentration-no-lm"]);
});

test("a grade condition remains a transparent advising warning, not a fake automatic check", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-finance", "rbsnb-finance-concentration"],
    programs: fixture.programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "rbsnb-finance-concentration-grade",
      program_id: "rbsnb-finance-concentration",
      condition_type: "minimum_course_grade",
      condition_value_json: '{"course_code":"33:390:300","minimum_grade":"B"}',
      decision: "requires_approval",
      note: "A B or better in Financial Management is required to declare.",
      source_url: "https://example.edu/finance",
    }],
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.warnings.map((issue) => issue.code), ["eligibility:rbsnb-finance-concentration-grade"]);
});

test("structured academic policy advisories remain selectable and tell the student what to confirm", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-finance"],
    programs: fixture.programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [
      {
        rule_key: "example-minimum-grade",
        program_id: "rbsnb-finance",
        condition_type: "minimum_course_grade",
        condition_value_json: '{"course_code":"01:790:101","minimum_grade":"C+"}',
        decision: "requires_approval",
        note: "A source-backed minimum grade applies.",
        source_url: "https://example.edu/minimum-grade",
      },
      {
        rule_key: "example-nb-residency",
        program_id: "rbsnb-finance",
        condition_type: "nb_residency_limit",
        condition_value_json: '{"maximum_outside_nb_credits":6}',
        decision: "requires_approval",
        note: "A source-backed residency limit applies.",
        source_url: "https://example.edu/nb-residency",
      },
      {
        rule_key: "example-school-approval",
        program_id: "rbsnb-finance",
        condition_type: "requires_school_approval",
        condition_value_json: '{"school":"SAS","action":"add this program"}',
        decision: "requires_approval",
        note: "A source-backed approval condition applies.",
        source_url: "https://example.edu/school-approval",
      },
      {
        rule_key: "example-transfer-limit",
        program_id: "rbsnb-finance",
        condition_type: "transfer_limit",
        condition_value_json: '{"maximum_transfer_credits":2}',
        decision: "requires_approval",
        note: "A source-backed transfer limit applies.",
        source_url: "https://example.edu/transfer-limit",
      },
    ],
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings.map((issue) => issue.code), [
    "eligibility:example-minimum-grade",
    "eligibility:example-nb-residency",
    "eligibility:example-school-approval",
    "eligibility:example-transfer-limit",
  ]);
  assert.deepEqual(result.warnings.map((issue) => issue.message), [
    "Confirm that you earned C+ or better in 01:790:101 before relying on this plan.",
    "Confirm that no more than 6 credits for this program were completed outside Rutgers–New Brunswick before relying on this plan.",
    "Ask SAS for approval to add this program before relying on this plan.",
    "Confirm that no more than 2 transfer credits apply to this program before relying on this plan.",
  ]);
  assert.ok(result.warnings.every((issue) => issue.advisory === true));
  assert.ok(result.warnings.every((issue) => !/audit/i.test(issue.message)));
});

test("a reviewed advisory marked as blocking fails closed as a data correction", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-finance"],
    programs: fixture.programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "example-blocking-grade-advisory",
      program_id: "rbsnb-finance",
      condition_type: "minimum_course_grade",
      condition_value_json: '{"course_code":"01:790:101","minimum_grade":"C+"}',
      decision: "blocked",
      note: "A source-backed minimum grade applies.",
      source_url: "https://example.edu/minimum-grade",
    }],
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.errors.map((issue) => issue.message), [
    "A reviewed advisory policy needs data correction before this selection can be confirmed.",
  ]);
});

test("public advisory data marked as blocking is shown only as a data correction", () => {
  const rule = publicEligibilityRule({
    rule_key: "example-blocking-grade-advisory",
    program_id: "rbsnb-finance",
    condition_type: "minimum_course_grade",
    condition_value_json: '{"course_code":"01:790:101","minimum_grade":"C+"}',
    decision: "blocked",
    note: "A source-backed minimum grade applies.",
    source_url: "https://example.edu/minimum-grade",
  });

  assert.equal(rule.advisory, false);
  assert.equal(
    rule.advisory_message,
    "A reviewed program policy needs data correction before this planning notice can be shown."
  );
});

test("an incomplete structured advisory fails closed instead of inventing a zero-credit limit", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-finance"],
    programs: fixture.programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "example-empty-transfer-limit",
      program_id: "rbsnb-finance",
      condition_type: "transfer_limit",
      condition_value_json: '{"maximum_transfer_credits":""}',
      decision: "requires_approval",
      note: "A source-backed transfer limit applies.",
      source_url: "https://example.edu/transfer-limit",
    }],
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.errors.map((issue) => issue.message), [
    "A reviewed program eligibility rule needs data correction before this selection can be confirmed.",
  ]);
});

test("a structured advisory without usable source provenance fails closed", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "rbsnb",
    selectedProgramIds: ["rbsnb-finance"],
    programs: fixture.programs,
    limits: [],
    combinationPolicies: [],
    eligibilityRules: [{
      rule_key: "example-unsourced-transfer-limit",
      program_id: "rbsnb-finance",
      condition_type: "transfer_limit",
      condition_value_json: '{"maximum_transfer_credits":2}',
      decision: "requires_approval",
      note: "A transfer limit applies.",
      source_url: "",
    }],
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.errors.map((issue) => issue.message), [
    "A reviewed advisory policy needs data correction before this selection can be confirmed.",
  ]);
});
