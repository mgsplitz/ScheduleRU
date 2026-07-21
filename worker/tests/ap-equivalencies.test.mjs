import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker from "../src/worker.js";

function database(rows) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return { async all() { return { results: rows }; } };
        },
      };
    },
  };
}

test("AP equivalency migration keeps reviewed score-specific catalog rows in one table", async () => {
  const schema = await readFile(new URL("../schema/schema_ap_equivalencies.sql", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS ap_equivalencies/);
  assert.match(schema, /CHECK \(minimum_score BETWEEN 1 AND 5\)/);
  assert.match(schema, /CHECK \(review_status IN \('draft','reviewed','retired'\)\)/);
  assert.match(schema, /ap-chem4/);
  assert.match(schema, /ap-chem5/);
  assert.match(schema, /ap-csa4/);
  assert.match(schema, /ap-csa5/);
});

test("configuration and AP routes use Worker configuration and reviewed D1 rows", async () => {
  const rows = [{ id: "ap-chem4", exam_name: "Chemistry", minimum_score: 4, maximum_score: 4 }];
  const db = database(rows);
  const env = { DB: db, CURRENT_YEAR: "2026", CURRENT_TERM: "9" };

  const configResponse = await worker.fetch(new Request("https://example.test/api/config"), env, {});
  assert.deepEqual(await configResponse.json(), { activeYear: 2026, activeTerm: "9" });

  const apResponse = await worker.fetch(new Request("https://example.test/api/ap-equivalencies"), env, {});
  assert.equal(apResponse.status, 200);
  assert.deepEqual(await apResponse.json(), { equivalencies: rows });
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /FROM ap_equivalencies/);
  assert.match(db.calls[0].sql, /review_status = 'reviewed'/);
});

test("configuration rejects invalid Worker active-term values", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/config"), {
    CURRENT_YEAR: "bad", CURRENT_TERM: "14",
  }, {});
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "invalid active term configuration" });
});
