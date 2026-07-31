import assert from "node:assert/strict";
import test from "node:test";

import {
  exportProgramDefinition,
  listReviewedProgramIds,
  type CatalogReadDatabase,
  type CatalogReadPreparedStatement,
} from "../src/index.ts";

type Row = Record<string, unknown>;

class ResultStatement implements CatalogReadPreparedStatement {
  private values: unknown[] = [];
  private readonly database: ResultDatabase;
  private readonly queryName: string;

  constructor(
    database: ResultDatabase,
    queryName: string,
  ) {
    this.database = database;
    this.queryName = queryName;
  }

  bind(...values: unknown[]): CatalogReadPreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    this.database.calls.push({ query: this.queryName, values: this.values });
    return (this.database.results[this.queryName]?.[0] as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    this.database.calls.push({ query: this.queryName, values: this.values });
    return { results: (this.database.results[this.queryName] ?? []) as T[] };
  }
}

class ResultDatabase implements CatalogReadDatabase {
  readonly calls: Array<{ query: string; values: unknown[] }> = [];
  readonly results: Record<string, Row[]>;

  constructor(results: Record<string, Row[]>) {
    this.results = results;
  }

  prepare(sql: string): CatalogReadPreparedStatement {
    const queryName = /catalog-export:([a-z-]+)/.exec(sql)?.[1];
    if (!queryName) throw new Error(`query is missing an export name: ${sql}`);
    return new ResultStatement(this, queryName);
  }
}

function reviewedRows(): Record<string, Row[]> {
  const url = "https://catalogs.rutgers.edu/example/requirements";
  return {
    programs: [
      {
        id: "sasnb-example-minor",
        name: "Example Studies",
        school_slug: "sasnb",
        program_slug: "example-studies",
        type: "minor",
        catalog_year: "2026-2027",
        academic_program_code: "999",
        degree_type: null,
        program_family_id: "sasnb-example-999",
        source_url: url,
        review_status: "reviewed",
        requirement_evidence_required: 1,
      },
    ],
    sources: [
      {
        source_url: url,
        source_title: "Example Studies requirements",
        source_catalog_year: "2026-2027",
        source_scope: "program_requirements",
        accessed_at: 1785456000000,
        note: "Official program requirements.",
      },
    ],
    groups: [
      {
        id: "sasnb-example-minor-root",
        parent_group_id: null,
        name: "Example Studies minor",
        rule: "all",
        count: null,
        sort_order: 10,
        display_family: null,
        display_priority: 0,
      },
      {
        id: "sasnb-example-minor-electives",
        parent_group_id: "sasnb-example-minor-root",
        name: "At most two electives",
        rule: "max",
        count: 2,
        sort_order: 20,
        display_family: "example-electives",
        display_priority: 5,
      },
    ],
    courses: [
      {
        group_id: "sasnb-example-minor-electives",
        course_code: "01:999:301",
        note: "Approved elective.",
        source_title: "Advanced Example Studies",
        source_credits: "3",
      },
    ],
    selectors: [
      {
        group_id: "sasnb-example-minor-electives",
        selector_key: "example-electives",
        selector_json: JSON.stringify({
          version: 1,
          kind: "subject_level",
          school_codes: ["01"],
          subject_codes: ["999"],
          course_number_min: 300,
          course_number_max: 499,
          minimum_credits: 3,
          label: "Upper-level Example Studies",
        }),
        source_url: url,
        source_label: "Example Studies requirements",
        review_status: "reviewed",
        reviewed_at: 1785456000000,
      },
    ],
    conditions: [
      {
        group_id: "sasnb-example-minor-electives",
        condition_type: "max_uses",
        condition_value_json: JSON.stringify({ maximum: 2 }),
        note: "No more than two shared courses.",
        source_url: url,
        review_status: "reviewed",
      },
    ],
    evidence: [
      {
        entity_type: "group",
        group_id: "sasnb-example-minor-root",
        course_code: null,
        source_url: url,
        source_title: "Example Studies requirements",
        source_catalog_year: "2026-2027",
        accessed_at: 1785456000000,
        reviewer_note: "Reviewed root requirement.",
        review_status: "reviewed",
      },
      {
        entity_type: "group",
        group_id: "sasnb-example-minor-electives",
        course_code: null,
        source_url: url,
        source_title: "Example Studies requirements",
        source_catalog_year: "2026-2027",
        accessed_at: 1785456000000,
        reviewer_note: "Reviewed elective requirement.",
        review_status: "reviewed",
      },
      {
        entity_type: "course",
        group_id: "sasnb-example-minor-electives",
        course_code: "01:999:301",
        source_url: url,
        source_title: "Example Studies requirements",
        source_catalog_year: "2026-2027",
        accessed_at: 1785456000000,
        reviewer_note: "Reviewed approved course.",
        review_status: "reviewed",
      },
    ],
    eligibility: [
      {
        rule_key: "sasnb-example-advising",
        condition_type: "advisor_confirmation",
        condition_value_json: JSON.stringify({ topics: ["Residency"] }),
        decision: "requires_approval",
        note: "Confirm residency with advising.",
        source_url: url,
        review_status: "reviewed",
        verified_at: 1785456000000,
      },
    ],
  };
}

test("lists reviewed programs in stable identifier order", async () => {
  const database = new ResultDatabase({
    "reviewed-programs": [
      { id: "sasnb-zeta-minor" },
      { id: "rbsnb-alpha-major" },
    ],
  });

  assert.deepEqual(
    await listReviewedProgramIds(database),
    ["rbsnb-alpha-major", "sasnb-zeta-minor"],
  );
  assert.deepEqual(database.calls, [{ query: "reviewed-programs", values: [] }]);
});

test("exports a complete reviewed definition without program-specific logic", async () => {
  const database = new ResultDatabase(reviewedRows());

  const definition = await exportProgramDefinition(
    database,
    "sasnb-example-minor",
  );

  assert.equal(definition.program.id, "sasnb-example-minor");
  assert.equal(definition.program.requirement_evidence_required, true);
  assert.equal(definition.sources.length, 1);
  assert.match(definition.sources[0]!.id, /^source-\d{3}$/);
  assert.equal(definition.requirement_groups[1]!.rule, "max_courses");
  assert.equal(definition.requirement_groups[1]!.courses[0]!.credits, 3);
  assert.equal(
    definition.requirement_groups[1]!.courses[0]!.evidence?.source_id,
    definition.sources[0]!.id,
  );
  assert.deepEqual(
    definition.requirement_groups[1]!.selectors[0]!.selector,
    {
      version: 1,
      kind: "subject_level",
      school_codes: ["01"],
      subject_codes: ["999"],
      course_number_min: 300,
      course_number_max: 499,
      minimum_credits: 3,
      label: "Upper-level Example Studies",
    },
  );
  assert.deepEqual(
    definition.requirement_groups[1]!.conditions[0]!.value,
    { maximum: 2 },
  );
  assert.deepEqual(
    definition.eligibility_rules[0]!.condition_value,
    { topics: ["Residency"] },
  );
  assert.equal(database.calls.length, 8);
  assert.equal(
    database.calls.every(({ values }) => values[0] === "sasnb-example-minor"),
    true,
  );

  const second = await exportProgramDefinition(
    new ResultDatabase(reviewedRows()),
    "sasnb-example-minor",
  );
  assert.deepEqual(second, definition);
});

test("rejects a missing program and malformed stored JSON", async () => {
  await assert.rejects(
    exportProgramDefinition(new ResultDatabase({ programs: [] }), "missing-program"),
    /reviewed program not found: missing-program/,
  );

  const rows = reviewedRows();
  rows.selectors![0]!.selector_json = "{broken";
  await assert.rejects(
    exportProgramDefinition(
      new ResultDatabase(rows),
      "sasnb-example-minor",
    ),
    /selectors\[0\]\.selector_json: invalid JSON/,
  );
});

test("fails closed when exported reviewed rows violate the contract", async () => {
  const rows = reviewedRows();
  rows.evidence = rows.evidence!.filter(
    (row) => row.course_code !== "01:999:301",
  );

  await assert.rejects(
    exportProgramDefinition(
      new ResultDatabase(rows),
      "sasnb-example-minor",
    ),
    /missing_reviewed_evidence/,
  );
});
