import assert from "node:assert/strict";
import test from "node:test";

import {
  exportReferenceDataBundle,
  type ReferenceDataReadDatabase,
  type ReferenceDataReadPreparedStatement,
} from "../src/index.ts";

type Row = Record<string, unknown>;

class Statement implements ReferenceDataReadPreparedStatement {
  private readonly database: Database;
  private readonly query: string;

  constructor(
    database: Database,
    query: string,
  ) {
    this.database = database;
    this.query = query;
  }

  bind(): ReferenceDataReadPreparedStatement {
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    this.database.calls.push(this.query);
    return { results: (this.database.rows[this.query] ?? []) as T[] };
  }
}

class Database implements ReferenceDataReadDatabase {
  readonly calls: string[] = [];
  readonly rows: Record<string, Row[]>;

  constructor(rows: Record<string, Row[]>) {
    this.rows = rows;
  }

  prepare(sql: string): ReferenceDataReadPreparedStatement {
    const query = /reference-data-export:([a-z-]+)/.exec(sql)?.[1];
    if (!query) throw new Error("missing query name");
    return new Statement(this, query);
  }
}

function rows(): Record<string, Row[]> {
  return {
    "school-profiles": [{
      slug: "example-school",
      institution_slug: "rutgers",
      campus_slug: "new-brunswick",
      name: "Example School",
      short_name: "Example",
      catalog_year: "2026-2027",
      configuration_json: "{\"default_program_id\":\"example-major\"}",
      source_url: "https://example.rutgers.edu/school",
      source_title: "Example school catalog",
      review_status: "reviewed",
      reviewed_at: 1785456000000,
      sort_order: 10,
    }],
    "curriculum-modules": [{
      school_slug: "example-school",
      module_type: "core_curriculum",
      curriculum_program_id: "example-core-curriculum",
      source_url: "https://example.rutgers.edu/core",
      review_status: "reviewed",
      reviewed_at: 1785456000000,
      sort_order: 10,
    }],
    "selection-limits": [{
      home_school_slug: "example-school",
      program_type: "major",
      max_selected: 2,
      note: "Two majors are permitted.",
      source_url: "https://example.rutgers.edu/policy",
      verified_at: 1785456000000,
    }],
    "combination-policies": [{
      policy_key: "example-combination-policy",
      home_school_slug: "example-school",
      program_a_id: "example-major",
      program_a_school_slug: null,
      program_a_type: null,
      program_b_id: null,
      program_b_school_slug: "other-school",
      program_b_type: "minor",
      same_program_family: 0,
      decision: "requires_approval",
      note: "Advising approval is required.",
      source_url: "https://example.rutgers.edu/policy",
      verified_at: 1785456000000,
    }],
    "double-count-rules": [{
      program_a: "example-major",
      program_b: "other-minor",
      max_shared_credits: 6,
      note: "Six shared credits.",
    }],
    "double-count-policies": [{
      school_slug: "example-school",
      scope: "major_major",
      max_shared_courses: 1,
      note: "One shared course is permitted.",
      source_url: "https://example.rutgers.edu/overlap",
      verified_at: 1785456000000,
    }],
    "double-count-exceptions": [{
      program_a: "example-major",
      program_b: "other-minor",
      allowed_course_codes_json: "[\"01:999:301\"]",
      note: "Published exception.",
      source_url: "https://example.rutgers.edu/overlap",
      review_status: "reviewed",
      verified_at: 1785456000000,
    }],
    equivalencies: [{
      program_id: "example-major",
      requirement_course_code: "01:999:101",
      equivalent_course_code: "01:999:102",
      note: "Approved substitute.",
      source_label: "Degree Navigator",
      review_status: "reviewed",
    }],
    "ap-equivalencies": [{
      id: "ap-example",
      exam_name: "Example Studies",
      minimum_score: 4,
      maximum_score: 5,
      credits: 3,
      equivalent_course_codes_json: "[\"01:999:101\"]",
      fulfills_requirement_ids_json: "[\"01999101\"]",
      catalog_year: "2026-2027",
      campus: "NB",
      source_url: "https://example.rutgers.edu/ap-credit",
      review_status: "reviewed",
      reviewed_at: "2026-08-01",
    }],
    "course-eligibility-reviews": [{
      course_code: "01:999:201",
      campus_slug: "new-brunswick",
      catalog_year: "2026-2027",
      review_status: "reviewed",
      no_known_conditions: 0,
      source_url: "https://example.rutgers.edu/course",
      source_label: "Example course page",
      source_date: "2026-08-01",
      reviewed_at: 1785542400000,
      note: "Reviewed course eligibility.",
    }],
    "course-eligibility-conditions": [{
      course_code: "01:999:201",
      condition_key: "intro-course",
      condition_type: "prerequisite_course",
      condition_value_json: "{\"any_of_course_codes\":[\"01:999:101\"]}",
      review_status: "reviewed",
      source_url: "https://example.rutgers.edu/course",
      source_label: "Example course page",
      source_date: "2026-08-01",
      reviewed_at: 1785542400000,
    }],
  };
}

test("exports all cross-program datasets and decodes stored JSON", async () => {
  const database = new Database(rows());
  const value = await exportReferenceDataBundle(database);
  assert.deepEqual(value.school_profiles[0]!.configuration, {
    default_program_id: "example-major",
  });
  assert.equal(
    value.program_combination_policies[0]!.same_program_family,
    false,
  );
  assert.deepEqual(
    value.double_count_exceptions[0]!.allowed_course_codes,
    ["01:999:301"],
  );
  assert.deepEqual(value.ap_equivalencies[0]!.equivalent_course_codes, [
    "01:999:101",
  ]);
  assert.equal(value.course_eligibility_reviews[0]!.no_known_conditions, false);
  assert.deepEqual(
    value.course_eligibility_conditions[0]!.condition_value,
    { any_of_course_codes: ["01:999:101"] },
  );
  assert.deepEqual(database.calls, [
    "school-profiles",
    "curriculum-modules",
    "selection-limits",
    "combination-policies",
    "double-count-rules",
    "double-count-policies",
    "double-count-exceptions",
    "equivalencies",
    "ap-equivalencies",
    "course-eligibility-reviews",
    "course-eligibility-conditions",
  ]);
});

test("fails closed when stored JSON is malformed", async () => {
  const value = rows();
  value["school-profiles"]![0]!.configuration_json = "{";
  value["course-eligibility-conditions"]![0]!.condition_value_json = "{";
  await assert.rejects(
    exportReferenceDataBundle(new Database(value)),
    /configuration_json|condition_value_json/,
  );
});
