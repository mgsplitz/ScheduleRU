import assert from "node:assert/strict";
import test from "node:test";

import {
  publishProgramDefinition,
  type CatalogDatabase,
  type CatalogPreparedStatement,
} from "../src/index.ts";

function definition(): Record<string, unknown> {
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
      source_url: "https://example.rutgers.edu/requirements",
      review_status: "reviewed",
      requirement_evidence_required: true,
    },
    sources: [
      {
        id: "requirements",
        url: "https://example.rutgers.edu/requirements",
        title: "Example requirements",
        catalog_year: "2026-2027",
        scope: "program_requirements",
        accessed_at: 1785456000000,
        note: "Official requirements.",
      },
    ],
    requirement_groups: [
      {
        id: "sasnb-example-minor-core",
        parent_group_id: null,
        name: "Core",
        rule: "all",
        count: null,
        sort_order: 10,
        display_family: null,
        display_priority: 0,
        courses: [
          {
            code: "01:999:101",
            title: "Introduction",
            credits: 3,
            note: null,
            evidence: {
              source_id: "requirements",
              reviewer_note: "Required introduction.",
              review_status: "reviewed",
            },
          },
        ],
        selectors: [
          {
            key: "example-core-options",
            source_id: "requirements",
            source_label: "Example requirements",
            review_status: "reviewed",
            reviewed_at: 1785456000000,
            selector: {
              version: 1,
              kind: "course_codes",
              include_course_codes: ["01:999:101"],
              label: "Required introduction",
            },
          },
        ],
        conditions: [
          {
            type: "allocation_family",
            value: { allocation_family: "example-core" },
            note: "Use once.",
            source_id: "requirements",
            review_status: "reviewed",
          },
        ],
        evidence: {
          source_id: "requirements",
          reviewer_note: "Official core.",
          review_status: "reviewed",
        },
      },
    ],
    eligibility_rules: [
      {
        key: "sasnb-example-minor-advising",
        condition_type: "advisor_confirmation",
        condition_value: { topics: ["Confirm residency."] },
        decision: "requires_approval",
        note: "Confirm residency.",
        source_id: "requirements",
        review_status: "reviewed",
        verified_at: 1785456000000,
      },
    ],
  };
}

interface RecordedStatement extends CatalogPreparedStatement {
  sql: string;
  params: unknown[];
}

class RecordingDatabase implements CatalogDatabase {
  prepared: RecordedStatement[] = [];
  batches: RecordedStatement[][] = [];
  failBatch = false;

  prepare(sql: string): CatalogPreparedStatement {
    const database = this;
    return {
      bind(...params: unknown[]): CatalogPreparedStatement {
        const statement: RecordedStatement = {
          sql,
          params,
          bind: this.bind,
        };
        database.prepared.push(statement);
        return statement;
      },
    };
  }

  async batch(statements: CatalogPreparedStatement[]): Promise<unknown[]> {
    if (this.failBatch) throw new Error("D1 batch failed");
    this.batches.push(statements as RecordedStatement[]);
    return statements.map(() => ({ success: true }));
  }
}

test("validates the complete definition before preparing database writes", async () => {
  const database = new RecordingDatabase();
  const invalid = definition();
  (invalid.program as Record<string, unknown>).id = "unsafe/id";

  await assert.rejects(
    publishProgramDefinition(database, invalid, { published_at: 1785456000000 }),
    /program\.id/,
  );
  assert.equal(database.prepared.length, 0);
  assert.equal(database.batches.length, 0);
});

test("replaces one program in an ordered D1 batch", async () => {
  const database = new RecordingDatabase();

  const result = await publishProgramDefinition(database, definition(), {
    published_at: 1785456000000,
  });

  assert.deepEqual(result, {
    program_id: "sasnb-example-minor",
    sources: 1,
    groups: 1,
    courses: 1,
    selectors: 1,
    conditions: 1,
    evidence: 2,
    eligibility_rules: 1,
    statement_count: database.batches[0]!.length,
    published_at: 1785456000000,
  });
  assert.equal(database.batches.length, 1);

  const sql = database.batches[0]!.map((statement) => statement.sql);
  const evidenceDelete = sql.findIndex((query) =>
    query.includes("DELETE FROM program_requirement_evidence"),
  );
  const groupDelete = sql.findIndex((query) =>
    query.includes("DELETE FROM requirement_groups"),
  );
  const programUpsert = sql.findIndex((query) =>
    query.includes("INSERT INTO programs"),
  );
  const groupInsert = sql.findIndex((query) =>
    query.includes("INSERT INTO requirement_groups"),
  );
  assert.ok(evidenceDelete >= 0 && evidenceDelete < groupDelete);
  assert.ok(programUpsert > groupDelete && programUpsert < groupInsert);

  for (const statement of database.batches[0]!) {
    if (statement.sql.startsWith("DELETE")) {
      assert.equal(statement.params[0], "sasnb-example-minor");
    }
  }
});

test("publishes every generic reviewed catalog entity", async () => {
  const database = new RecordingDatabase();

  await publishProgramDefinition(database, definition(), {
    published_at: 1785456000000,
  });

  const sql = database.batches[0]!.map((statement) => statement.sql).join("\n");
  assert.match(sql, /INSERT INTO program_sources/);
  assert.match(sql, /INSERT INTO requirement_groups/);
  assert.match(sql, /INSERT INTO requirement_courses/);
  assert.match(sql, /INSERT INTO requirement_course_selectors/);
  assert.match(sql, /INSERT INTO requirement_group_conditions/);
  assert.match(sql, /INSERT INTO program_requirement_evidence/);
  assert.match(sql, /INSERT INTO program_eligibility_rules/);
});

test("derives normalized course attributes from reviewed Core groups", async () => {
  const database = new RecordingDatabase();
  const value = definition();
  (value.program as Record<string, unknown>).type = "core_curriculum";
  const group = (value.requirement_groups as Array<Record<string, unknown>>)[0]!;
  group.name = "Revision-Based Writing [WCr]";

  await publishProgramDefinition(database, value, { published_at: 1785456000000 });

  const attributeInsert = database.batches[0]!.find((entry) =>
    entry.sql.includes("INSERT INTO course_requirement_attributes")
  );
  assert.ok(attributeInsert);
  assert.deepEqual(attributeInsert.params, [
    "sasnb-example-minor",
    "sasnb-example-minor-core",
    "01:999:101",
    "WCr",
  ]);
});

test("identical definitions produce identical statements and binds", async () => {
  const first = new RecordingDatabase();
  const second = new RecordingDatabase();

  await publishProgramDefinition(first, definition(), {
    published_at: 1785456000000,
  });
  await publishProgramDefinition(second, definition(), {
    published_at: 1785456000000,
  });

  const serializable = (database: RecordingDatabase) =>
    database.batches.map((batch) =>
      batch.map(({ sql, params }) => ({ sql, params }))
    );
  assert.deepEqual(serializable(first), serializable(second));
});

test("does not report publication when the transactional batch fails", async () => {
  const database = new RecordingDatabase();
  database.failBatch = true;

  await assert.rejects(
    publishProgramDefinition(database, definition(), {
      published_at: 1785456000000,
    }),
    /D1 batch failed/,
  );
  assert.equal(database.batches.length, 0);
});

test("large programs stay within free-tier query and D1 bind limits", async () => {
  const value = definition();
  const group = (
    value.requirement_groups as Array<Record<string, unknown>>
  )[0]!;
  group.courses = Array.from({ length: 120 }, (_, index) => ({
    code: `01:999:${String(100 + index).padStart(3, "0")}`,
    title: `Example course ${index + 1}`,
    credits: 3,
    note: null,
    evidence: {
      source_id: "requirements",
      reviewer_note: `Reviewed course ${index + 1}.`,
      review_status: "reviewed",
    },
  }));
  group.selectors = [];
  const database = new RecordingDatabase();

  await publishProgramDefinition(database, value, {
    published_at: 1785456000000,
  });

  assert.ok(database.batches[0]!.length <= 50);
  assert.ok(
    database.batches[0]!.every((statement) => statement.params.length <= 100),
  );
});
