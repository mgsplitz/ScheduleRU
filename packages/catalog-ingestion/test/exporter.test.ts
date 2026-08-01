import assert from "node:assert/strict";
import test from "node:test";

import {
  exportCatalogReviewBacklog,
  type CatalogIngestionReadDatabase,
  type CatalogIngestionReadPreparedStatement,
} from "../src/index.ts";

class Statement implements CatalogIngestionReadPreparedStatement {
  private readonly rows: Array<Record<string, unknown>>;
  constructor(rows: Array<Record<string, unknown>>) {
    this.rows = rows;
  }
  bind(): CatalogIngestionReadPreparedStatement {
    return this;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.rows as T[] };
  }
}

class Database implements CatalogIngestionReadDatabase {
  private readonly rows: Array<Record<string, unknown>>;
  constructor(rows: Array<Record<string, unknown>>) {
    this.rows = rows;
  }
  prepare(sql: string): CatalogIngestionReadPreparedStatement {
    assert.match(sql, /catalog-ingestion-export:review-notes/);
    return new Statement(this.rows);
  }
}

test("exports stable review notes and converts SQLite flags to booleans", async () => {
  const value = await exportCatalogReviewBacklog(new Database([
    {
      program_id: "example-major",
      section_name: "Electives",
      raw_text: "Choose one course.",
      resolved: 0,
    },
  ]));
  assert.deepEqual(value.review_notes, [{
    program_id: "example-major",
    section_name: "Electives",
    raw_text: "Choose one course.",
    resolved: false,
  }]);
});

test("fails closed on malformed stored rows", async () => {
  await assert.rejects(
    exportCatalogReviewBacklog(new Database([{
      program_id: "unsafe/id",
      section_name: null,
      raw_text: "Bad row.",
      resolved: 0,
    }])),
    /review_notes\[0\]\.program_id/,
  );
});
