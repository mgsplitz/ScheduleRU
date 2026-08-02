import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequirementImportRepository,
} from "../../apps/api/src/programs/storage/requirement-import-repository.js";

function fakeDatabase() {
  const prepared = [];
  return {
    prepared,
    prepare(sql) {
      const call = { sql, bindings: [] };
      prepared.push(call);
      const statement = {
        bind(...bindings) {
          call.bindings = bindings;
          return statement;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
        async all() {
          return { results: [{ id: "source-one" }] };
        },
        async first() {
          return null;
        },
      };
      return statement;
    },
  };
}

test("requirement import repository stores snapshots before marking sources current", async () => {
  const DB = fakeDatabase();
  const repository = createRequirementImportRepository({ DB }, { now: () => 5678 });

  assert.deepEqual(await repository.saveSnapshot({
    source_id: "source-one",
    program_id: "program-one",
    source_url: "https://example.rutgers.edu/requirements",
    source_title: "Requirements",
    content_hash: "0123456789abcdef",
    content_text: "01:123:101",
    parsed_json: "{}",
  }), { changed: true });

  assert.match(DB.prepared[0].sql, /INSERT OR IGNORE INTO program_requirement_source_snapshots/);
  assert.match(DB.prepared[1].sql, /last_content_hash = \?/);
  assert.deepEqual(DB.prepared[1].bindings, [
    5678,
    "0123456789abcdef",
    "source-one",
  ]);
});

test("requirement import repository selects only untouched sources in stable order", async () => {
  const DB = fakeDatabase();
  const repository = createRequirementImportRepository({ DB });

  assert.deepEqual(await repository.listPendingSources("sasnb", 20), [{ id: "source-one" }]);
  assert.match(DB.prepared[0].sql, /last_imported_at IS NULL/);
  assert.match(DB.prepared[0].sql, /last_error IS NULL/);
  assert.match(DB.prepared[0].sql, /ORDER BY id/);
  assert.deepEqual(DB.prepared[0].bindings, ["sasnb", 20]);
});
