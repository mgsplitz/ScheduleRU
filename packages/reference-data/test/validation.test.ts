import assert from "node:assert/strict";
import test from "node:test";

import { validateReferenceDataBundle } from "../src/index.ts";
import { bundle } from "./fixtures.ts";

test("accepts a complete generic reference-data bundle", () => {
  const result = validateReferenceDataBundle(bundle());
  assert.equal(result.ok, true);
});

test("rejects encoded JSON and invalid official sources", () => {
  const value = bundle();
  const profiles = value.school_profiles as Array<Record<string, unknown>>;
  profiles[0]!.configuration = "{\"unsafe\":true}";
  profiles[0]!.source_url = "https://example.com";
  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    ["school_profiles[0].configuration", "school_profiles[0].source_url"],
  );
});

test("requires both combination-policy sides to contain a matcher", () => {
  const value = bundle();
  const policies =
    value.program_combination_policies as Array<Record<string, unknown>>;
  policies[0]!.program_b_id = null;
  policies[0]!.program_b_school_slug = null;
  policies[0]!.program_b_type = null;
  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.issues[0]!.path, "program_combination_policies[0]");
  assert.equal(result.issues[0]!.code, "missing_policy_matcher");
});

test("rejects duplicate natural keys and malformed course codes", () => {
  const value = bundle();
  const limits = value.program_selection_limits as unknown[];
  limits.push(structuredClone(limits[0]));
  const exceptions = value.double_count_exceptions as Array<Record<string, unknown>>;
  exceptions[0]!.allowed_course_codes = ["bad-code"];
  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some(({ code }) => code === "duplicate_key"));
  assert.ok(result.issues.some(({ code }) => code === "invalid_course_code"));
});

test("validates school-wide double-count policy scopes and caps", () => {
  const value = bundle();
  const rows = value.double_count_policies as Array<Record<string, unknown>>;
  rows[0]!.scope = "invented_scope";
  rows[0]!.max_shared_courses = -1;
  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    [
      "double_count_policies[0].scope",
      "double_count_policies[0].max_shared_courses",
    ],
  );
});

test("validates reviewed course eligibility facts and condition values", () => {
  const value = bundle();
  const reviews =
    value.course_eligibility_reviews as Array<Record<string, unknown>>;
  const conditions =
    value.course_eligibility_conditions as Array<Record<string, unknown>>;
  reviews[0]!.no_known_conditions = "false";
  conditions[0]!.condition_type = "invented_rule";
  conditions[0]!.condition_value = "{\"unsafe\":true}";
  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    [
      "course_eligibility_reviews[0].no_known_conditions",
      "course_eligibility_conditions[0].condition_type",
      "course_eligibility_conditions[0].condition_value",
    ],
  );
});

test("credit exclusions require a reviewed policy, valid members, and a usable cap", () => {
  const value = bundle();
  const policies = value.course_credit_exclusion_policies as Array<Record<string, unknown>>;
  const members = value.course_credit_exclusion_members as Array<Record<string, unknown>>;
  policies[0]!.max_courses = 0;
  members[0]!.course_code = "bad-code";
  members[1]!.policy_key = "missing-policy";

  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    [
      "course_credit_exclusion_policies[0].max_courses",
      "course_credit_exclusion_members[0].course_code",
      "course_credit_exclusion_members[1].policy_key",
    ],
  );
});

test("credit exclusions cannot publish without enough distinct member courses", () => {
  const value = bundle();
  const members = value.course_credit_exclusion_members as Array<Record<string, unknown>>;
  members.splice(1);

  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.issues.map(({ path, code }) => ({ path, code })), [{
    path: "course_credit_exclusion_policies[0]",
    code: "incomplete_credit_exclusion",
  }]);
});

test("validates AP score bands and decoded equivalency arrays", () => {
  const value = bundle();
  const rows = value.ap_equivalencies as Array<Record<string, unknown>>;
  rows[0]!.minimum_score = 6;
  rows[0]!.maximum_score = 0;
  rows[0]!.equivalent_course_codes = ["bad-code"];
  rows[0]!.fulfills_requirement_ids = ["bad-id"];
  const result = validateReferenceDataBundle(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    [
      "ap_equivalencies[0].minimum_score",
      "ap_equivalencies[0].maximum_score",
      "ap_equivalencies[0].equivalent_course_codes[0]",
      "ap_equivalencies[0].fulfills_requirement_ids[0]",
    ],
  );
});
