import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProgramDefinition,
  validateProgramDefinition,
} from "../src/index.ts";

function validDefinition(): Record<string, unknown> {
  return {
    contract_version: 1,
    program: {
      id: "sasnb-example-minor",
      name: "Example Studies",
      school_slug: "sasnb",
      program_slug: "example-studies",
      type: "minor",
      catalog_year: "2026-2027",
      academic_program_code: "999",
      degree_type: null,
      program_family_id: "sasnb-example-999",
      source_url: "https://example.rutgers.edu/academics/example",
      review_status: "reviewed",
      requirement_evidence_required: true,
    },
    sources: [
      {
        id: "requirements",
        url: "https://example.rutgers.edu/academics/example",
        title: "Example Studies requirements",
        catalog_year: "2026-2027",
        scope: "program_requirements",
        accessed_at: 1785456000000,
        note: "Official department requirements.",
      },
    ],
    requirement_groups: [
      {
        id: "sasnb-example-minor-core",
        parent_group_id: null,
        name: "Required course",
        rule: "all",
        count: null,
        sort_order: 10,
        display_family: null,
        display_priority: 0,
        courses: [
          {
            code: "01:999:101",
            title: "Introduction to Example Studies",
            credits: 3,
            note: null,
            evidence: {
              source_id: "requirements",
              reviewer_note: "Listed as the required introduction.",
              review_status: "reviewed",
            },
          },
        ],
        selectors: [],
        conditions: [],
        evidence: {
          source_id: "requirements",
          reviewer_note: "Official required-course group.",
          review_status: "reviewed",
        },
      },
      {
        id: "sasnb-example-minor-electives",
        parent_group_id: null,
        name: "Three electives",
        rule: "min_courses",
        count: 3,
        sort_order: 20,
        display_family: null,
        display_priority: 0,
        courses: [],
        selectors: [
          {
            key: "example-electives",
            source_id: "requirements",
            source_label: "Example Studies requirements",
            review_status: "reviewed",
            reviewed_at: 1785456000000,
            selector: {
              version: 1,
              kind: "subject_level",
              school_codes: ["01"],
              subject_codes: ["999"],
              course_number_min: 200,
              course_number_max: 499,
              minimum_credits: 3,
              exclude_course_codes: ["01:999:299"],
              label: "Example Studies electives at the 200 level or above",
            },
          },
        ],
        conditions: [],
        evidence: {
          source_id: "requirements",
          reviewer_note: "Official three-elective group.",
          review_status: "reviewed",
        },
      },
    ],
    eligibility_rules: [
      {
        key: "sasnb-example-minor-advising",
        condition_type: "advisor_confirmation",
        condition_value: {
          topics: ["Confirm residency rules with the department."],
        },
        decision: "requires_approval",
        note: "Confirm residency rules before relying on the plan.",
        source_id: "requirements",
        review_status: "reviewed",
        verified_at: 1785456000000,
      },
    ],
  };
}

function hasIssue(
  result: ReturnType<typeof validateProgramDefinition>,
  code: string,
  path?: string,
): boolean {
  return result.issues.some(
    (issue) => issue.code === code && (path === undefined || issue.path === path),
  );
}

test("accepts a complete generic reviewed program definition", () => {
  const value = validDefinition();
  const result = validateProgramDefinition(value);

  assert.deepEqual(result, { ok: true, value, issues: [] });
  assert.equal(assertProgramDefinition(value), value);
});

test("rejects unsupported contracts and unsafe program identity", () => {
  const value = validDefinition();
  value.contract_version = 2;
  (value.program as Record<string, unknown>).id = "../unsafe";

  const result = validateProgramDefinition(value);

  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "unsupported_version", "contract_version"), true);
  assert.equal(hasIssue(result, "invalid_identifier", "program.id"), true);
});

test("accepts only official Rutgers HTTPS sources", () => {
  const value = validDefinition();
  (value.sources as Array<Record<string, unknown>>)[0]!.url =
    "http://catalog.example.com/program";

  const result = validateProgramDefinition(value);

  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "invalid_source_url", "sources[0].url"), true);
});

test("rejects duplicate groups, missing parents, and requirement cycles", () => {
  const duplicate = validDefinition();
  const duplicateGroups = duplicate.requirement_groups as Array<Record<string, unknown>>;
  duplicateGroups.push({ ...duplicateGroups[0] });
  assert.equal(
    hasIssue(validateProgramDefinition(duplicate), "duplicate_group_id"),
    true,
  );

  const missing = validDefinition();
  (missing.requirement_groups as Array<Record<string, unknown>>)[1]!.parent_group_id =
    "missing-group";
  assert.equal(
    hasIssue(validateProgramDefinition(missing), "missing_parent_group"),
    true,
  );

  const cyclic = validDefinition();
  const cyclicGroups = cyclic.requirement_groups as Array<Record<string, unknown>>;
  cyclicGroups[0]!.parent_group_id = cyclicGroups[1]!.id;
  cyclicGroups[1]!.parent_group_id = cyclicGroups[0]!.id;
  assert.equal(
    hasIssue(validateProgramDefinition(cyclic), "requirement_cycle"),
    true,
  );
});

test("rejects unsupported rules and invalid count semantics", () => {
  const unsupported = validDefinition();
  (unsupported.requirement_groups as Array<Record<string, unknown>>)[0]!.rule =
    "take-whatever";
  assert.equal(
    hasIssue(validateProgramDefinition(unsupported), "unsupported_rule"),
    true,
  );

  const missingCount = validDefinition();
  (missingCount.requirement_groups as Array<Record<string, unknown>>)[1]!.count = null;
  assert.equal(
    hasIssue(validateProgramDefinition(missingCount), "invalid_rule_count"),
    true,
  );

  const unexpectedCount = validDefinition();
  (unexpectedCount.requirement_groups as Array<Record<string, unknown>>)[0]!.count = 1;
  assert.equal(
    hasIssue(validateProgramDefinition(unexpectedCount), "invalid_rule_count"),
    true,
  );
});

test("accepts every count-based rule used by reviewed requirements", () => {
  for (const rule of [
    "min_courses",
    "max_courses",
    "min_credits",
    "max_credits",
    "min_distinct_children",
  ]) {
    const value = validDefinition();
    const group = (
      value.requirement_groups as Array<Record<string, unknown>>
    )[1]!;
    group.rule = rule;
    group.count = 2;

    assert.equal(
      validateProgramDefinition(value).ok,
      true,
      `${rule} should accept a positive integer count`,
    );
  }
});

test("rejects duplicate course codes inside one requirement group", () => {
  const value = validDefinition();
  const courses = (
    value.requirement_groups as Array<Record<string, unknown>>
  )[0]!.courses as Array<Record<string, unknown>>;
  courses.push({ ...courses[0] });

  const result = validateProgramDefinition(value);

  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "duplicate_course_code"), true);
});

test("rejects malformed course selectors", () => {
  const value = validDefinition();
  const selector = (
    (
      value.requirement_groups as Array<Record<string, unknown>>
    )[1]!.selectors as Array<Record<string, unknown>>
  )[0]!.selector as Record<string, unknown>;
  selector.course_number_min = 500;
  selector.course_number_max = 200;

  const result = validateProgramDefinition(value);

  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "invalid_selector_range"), true);
});

test("reviewed programs fail closed when group or course evidence is absent", () => {
  const missingGroupEvidence = validDefinition();
  delete (
    missingGroupEvidence.requirement_groups as Array<Record<string, unknown>>
  )[0]!.evidence;
  assert.equal(
    hasIssue(
      validateProgramDefinition(missingGroupEvidence),
      "missing_reviewed_evidence",
    ),
    true,
  );

  const missingCourseEvidence = validDefinition();
  delete (
    (
      missingCourseEvidence.requirement_groups as Array<Record<string, unknown>>
    )[0]!.courses as Array<Record<string, unknown>>
  )[0]!.evidence;
  assert.equal(
    hasIssue(
      validateProgramDefinition(missingCourseEvidence),
      "missing_reviewed_evidence",
    ),
    true,
  );
});

test("evidence must reference a declared source", () => {
  const value = validDefinition();
  (
    (
      value.requirement_groups as Array<Record<string, unknown>>
    )[0]!.evidence as Record<string, unknown>
  ).source_id = "unknown-source";

  const result = validateProgramDefinition(value);

  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, "unknown_evidence_source"), true);
});

test("assertProgramDefinition reports stable path-addressed issues", () => {
  const value = validDefinition();
  (value.program as Record<string, unknown>).name = "";

  assert.throws(
    () => assertProgramDefinition(value),
    /program\.name: must be a non-empty string/,
  );
});
