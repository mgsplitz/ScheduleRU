import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluateProgramSelection } from "../src/program-selection-policy.js";

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
    }],
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.warnings.map((issue) => issue.code), ["eligibility:rbsnb-finance-concentration-grade"]);
});
