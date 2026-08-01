import assert from "node:assert/strict";
import test from "node:test";

import {
  publishCatalogReviewBacklog,
  type CatalogIngestionDatabase,
  type CatalogIngestionPreparedStatement,
} from "../src/index.ts";
import { backlog } from "./fixtures.ts";

interface Recorded extends CatalogIngestionPreparedStatement {
  sql: string;
  params: unknown[];
}

class Database implements CatalogIngestionDatabase {
  prepared: Recorded[] = [];
  batches: Recorded[][] = [];
  fail = false;

  prepare(sql: string): CatalogIngestionPreparedStatement {
    const database = this;
    return {
      bind(...params: unknown[]) {
        const result: Recorded = { sql, params, bind: this.bind };
        database.prepared.push(result);
        return result;
      },
    };
  }

  async batch(statements: CatalogIngestionPreparedStatement[]) {
    if (this.fail) throw new Error("D1 batch failed");
    this.batches.push(statements as Recorded[]);
    return statements.map(() => ({ success: true }));
  }
}

test("validates the entire backlog before preparing a write", async () => {
  const database = new Database();
  await assert.rejects(
    publishCatalogReviewBacklog(database, { contract_version: 1 }),
    /review_notes/,
  );
  assert.equal(database.prepared.length, 0);
});

test("replaces all notes transactionally in deterministic order", async () => {
  const database = new Database();
  const result = await publishCatalogReviewBacklog(database, backlog());
  assert.deepEqual(result, { note_count: 2, statement_count: 3 });
  assert.equal(database.batches.length, 1);
  assert.match(database.batches[0]![0]!.sql, /DELETE FROM requirement_raw_notes/);
  assert.deepEqual(
    database.batches[0]!.slice(1).map(({ params }) => params[0]),
    ["example-major", "example-minor"],
  );
});

test("does not report a failed D1 batch", async () => {
  const database = new Database();
  database.fail = true;
  await assert.rejects(
    publishCatalogReviewBacklog(database, backlog()),
    /D1 batch failed/,
  );
  assert.equal(database.batches.length, 0);
});
