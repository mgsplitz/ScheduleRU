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
