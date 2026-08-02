import assert from "node:assert/strict";
import test from "node:test";
import {
  createCatalogDirectoryRepository,
} from "../../apps/api/src/programs/storage/catalog-directory-repository.js";

function fakeDatabase() {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      const call = { sql, bindings: [] };
      prepared.push(call);
      const statement = {
        call,
        bind(...bindings) {
          call.bindings = bindings;
          return statement;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return null;
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(statements.map((statement) => statement.call));
      return statements.map(() => ({ success: true }));
    },
  };
}

test("catalog directory repository publishes entries before retiring stale listings", async () => {
  const DB = fakeDatabase();
  const repository = createCatalogDirectoryRepository({ DB }, { now: () => 5678 });

  await repository.replaceEntries(
    { id: "sas-program-directory" },
    [{
      id: "sasnb-economics-major",
      name: "Economics",
      school_slug: "sasnb",
      program_slug: "economics",
      type: "major",
      catalog_year: "2026",
      degree_type: "BA",
      program_family_id: "sasnb-economics",
      source_url: "https://example.rutgers.edu/profiles/economics",
      review_status: "catalog_listed",
    }],
    "lease-token",
  );

  assert.equal(DB.batches.length, 1);
  assert.match(DB.batches[0][0].sql, /INSERT INTO programs/);
  assert.match(DB.prepared.at(-2).sql, /SET catalog_active = 0/);
  assert.match(DB.prepared.at(-1).sql, /import_token = NULL/);
  assert.deepEqual(DB.prepared.at(-1).bindings, [
    5678,
    "sas-program-directory",
    "lease-token",
  ]);
});

test("catalog directory repository uses a ten-minute stale-lease window", async () => {
  const DB = fakeDatabase();
  const repository = createCatalogDirectoryRepository({ DB });

  assert.equal(
    await repository.acquireImportLease("source", "token", 1_000_000),
    true,
  );
  assert.deepEqual(DB.prepared[0].bindings, [
    "token",
    1_000_000,
    "source",
    400_000,
  ]);
});
