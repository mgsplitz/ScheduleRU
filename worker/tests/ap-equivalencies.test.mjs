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

test("AP equivalency schema is structural and reviewed rows are portable", async () => {
  const [schema, snapshot] = await Promise.all([
    readFile(new URL("../../migrations/schema_ap_equivalencies.sql", import.meta.url), "utf8"),
    readFile(
      new URL("../../reference-data/snapshots/reviewed-reference-data.v1.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS ap_equivalencies/);
  assert.match(schema, /CHECK \(minimum_score BETWEEN 1 AND 5\)/);
  assert.match(schema, /CHECK \(review_status IN \('draft','reviewed','retired'\)\)/);
  assert.match(schema, /PRIMARY KEY \(id, catalog_year, campus\)/);
  assert.doesNotMatch(schema, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/);
  assert.equal(snapshot.ap_equivalencies.length, 37);
  assert.deepEqual(
    snapshot.ap_equivalencies
      .filter(({ id }) => ["ap-chem4", "ap-chem5", "ap-csa4", "ap-csa5"].includes(id))
      .map(({ id }) => id)
      .sort(),
    ["ap-chem4", "ap-chem5", "ap-csa4", "ap-csa5"].sort(),
  );
});

test("AP runbook is dev-first, snapshot-backed, and smoke-testable", async () => {
  const [readme, schema] = await Promise.all([
    readFile(new URL("../../README.md", import.meta.url), "utf8"),
    readFile(new URL("../../migrations/schema_ap_equivalencies.sql", import.meta.url), "utf8"),
  ]);

  assert.match(readme, /npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=\.\.\/migrations\/schema_ap_equivalencies\.sql/);
  assert.match(readme, /npm run reference-data -- restore/);
  assert.match(readme, /reviewed-reference-data\.v1\.json/);
  assert.match(readme, /approval-only/);
  assert.match(
    readme,
    /structural AP-equivalency table[\s\S]*validated reference-data\s+snapshot/,
  );
  assert.match(readme, /curl --fail --silent --show-error "\$DEV_WORKER_URL\/api\/ap-equivalencies"/);
  assert.doesNotMatch(schema, /\bINSERT INTO ap_equivalencies\b/);
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
  assert.match(db.calls[0].sql, /catalog_year = \?/);
  assert.match(db.calls[0].sql, /campus = \?/);
  assert.deepEqual(db.calls[0].values, ["2026-2027", "NB"]);
});

test("configuration rejects invalid Worker active-term values", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/config"), {
    CURRENT_YEAR: "bad", CURRENT_TERM: "14",
  }, {});
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "invalid active term configuration" });
});

test("AP route returns a generic public error when D1 fails", async () => {
  const DB = {
    prepare() {
      return {
        bind() {
          return { async all() { throw new Error("sensitive D1 internals"); } };
        },
      };
    },
  };
  const response = await worker.fetch(new Request("https://example.test/api/ap-equivalencies"), {
    DB, CURRENT_YEAR: "2026", CURRENT_TERM: "9",
  }, {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AP equivalencies unavailable" });
});
