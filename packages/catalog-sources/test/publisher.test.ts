import assert from "node:assert/strict";
import test from "node:test";

import {
  publishCatalogSourceBundle,
  type CatalogSourceDatabase,
  type CatalogSourcePreparedStatement,
} from "../src/index.ts";
import { sourceBundle } from "./fixtures.ts";

interface Recorded extends CatalogSourcePreparedStatement {
  sql: string;
  params: unknown[];
}

class Database implements CatalogSourceDatabase {
  readonly prepared: Recorded[] = [];
  readonly batches: Recorded[][] = [];

  prepare(sql: string): CatalogSourcePreparedStatement {
    const database = this;
    return {
      bind(...params: unknown[]): CatalogSourcePreparedStatement {
        const value: Recorded = { sql, params, bind: this.bind };
        database.prepared.push(value);
        return value;
      },
    };
  }

  async batch(statements: CatalogSourcePreparedStatement[]): Promise<unknown[]> {
    this.batches.push(statements as Recorded[]);
    return statements.map(() => ({ success: true }));
  }
}

test("validates the full bundle before preparing writes", async () => {
  const database = new Database();
  const invalid = sourceBundle();
  invalid.sources = "invalid";
  await assert.rejects(publishCatalogSourceBundle(database, invalid), /sources/);
  assert.equal(database.prepared.length, 0);
});

test("upserts managed fields without replacing runtime import state", async () => {
  const database = new Database();
  const result = await publishCatalogSourceBundle(database, sourceBundle());
  assert.deepEqual(result.row_counts, { sources: 1, identity_overrides: 1 });
  assert.equal(database.batches.length, 1);
  const sql = database.batches[0]!.map(({ sql }) => sql).join("\n");
  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE SET/);
  assert.doesNotMatch(
    sql,
    /last_imported_at|last_content_hash|last_error|import_token|import_started_at/,
  );
  assert.match(sql, /DELETE FROM program_catalog_identity_overrides/);
  assert.doesNotMatch(sql, /DELETE FROM program_catalog_sources/);
});

test("creates deterministic idempotent statements", async () => {
  const first = new Database();
  const second = new Database();
  await publishCatalogSourceBundle(first, sourceBundle());
  await publishCatalogSourceBundle(second, sourceBundle());
  const simplify = (database: Database) =>
    database.batches[0]!.map(({ sql, params }) => ({ sql, params }));
  assert.deepEqual(simplify(first), simplify(second));
});
