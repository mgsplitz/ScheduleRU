import assert from "node:assert/strict";
import test from "node:test";

import {
  publishReferenceDataBundle,
  type ReferenceDataDatabase,
  type ReferenceDataPreparedStatement,
} from "../src/index.ts";
import { bundle } from "./fixtures.ts";

interface Recorded extends ReferenceDataPreparedStatement {
  sql: string;
  params: unknown[];
}

class Database implements ReferenceDataDatabase {
  readonly prepared: Recorded[] = [];
  readonly batches: Recorded[][] = [];
  fail = false;

  prepare(sql: string): ReferenceDataPreparedStatement {
    const database = this;
    return {
      bind(...params: unknown[]): ReferenceDataPreparedStatement {
        const statement: Recorded = { sql, params, bind: this.bind };
        database.prepared.push(statement);
        return statement;
      },
    };
  }

  async batch(statements: ReferenceDataPreparedStatement[]): Promise<unknown[]> {
    if (this.fail) throw new Error("D1 batch failed");
    this.batches.push(statements as Recorded[]);
    return statements.map(() => ({ success: true }));
  }
}

test("validates the complete bundle before preparing writes", async () => {
  const database = new Database();
  const value = bundle();
  value.school_profiles = "bad";
  await assert.rejects(
    publishReferenceDataBundle(database, value),
    /school_profiles/,
  );
  assert.equal(database.prepared.length, 0);
});

test("replaces every managed dataset in one ordered batch", async () => {
  const database = new Database();
  const result = await publishReferenceDataBundle(database, bundle());
  assert.equal(database.batches.length, 1);
  assert.deepEqual(result.row_counts, {
    school_profiles: 1,
    school_curriculum_modules: 1,
    program_selection_limits: 1,
    program_combination_policies: 1,
    double_count_rules: 1,
    double_count_policies: 1,
    double_count_exceptions: 1,
    requirement_course_equivalencies: 1,
    ap_equivalencies: 1,
    course_eligibility_reviews: 1,
    course_eligibility_conditions: 1,
  });
  const sql = database.batches[0]!.map(({ sql }) => sql);
  assert.ok(
    sql.findIndex((value) =>
      value.includes("DELETE FROM school_curriculum_modules")
    )
      < sql.findIndex((value) => value.includes("DELETE FROM school_profiles")),
  );
  assert.match(sql.join("\n"), /INSERT INTO requirement_course_equivalencies/);
  assert.match(sql.join("\n"), /INSERT INTO double_count_policies/);
  assert.match(sql.join("\n"), /INSERT INTO ap_equivalencies/);
  assert.match(sql.join("\n"), /INSERT INTO course_eligibility_reviews/);
  assert.match(sql.join("\n"), /INSERT INTO course_eligibility_conditions/);
});

test("serializes JSON values once and produces idempotent statements", async () => {
  const first = new Database();
  const second = new Database();
  await publishReferenceDataBundle(first, bundle());
  await publishReferenceDataBundle(second, bundle());
  const recorded = (database: Database) =>
    database.batches.map((batch) =>
      batch.map(({ sql, params }) => ({ sql, params }))
    );
  assert.deepEqual(recorded(first), recorded(second));
  assert.ok(
    first.prepared.some(({ params }) =>
      params.includes("{\"default_program_id\":\"example-major\"}")
    ),
  );
  assert.ok(
    first.prepared.some(({ params }) =>
      params.includes("{\"any_of_course_codes\":[\"01:999:101\"]}")
    ),
  );
});

test("does not report a failed transactional batch", async () => {
  const database = new Database();
  database.fail = true;
  await assert.rejects(
    publishReferenceDataBundle(database, bundle()),
    /D1 batch failed/,
  );
  assert.equal(database.batches.length, 0);
});
