import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequirementCandidateRepository,
} from "../../apps/api/src/programs/storage/requirement-candidate-repository.js";

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
        async all() {
          return { results: [{ source_id: "source-one" }] };
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

test("requirement candidate repository selects only unprocessed catalog-listed major snapshots", async () => {
  const DB = fakeDatabase();
  const repository = createRequirementCandidateRepository({ DB });

  assert.deepEqual(await repository.listPendingSnapshots("sasnb", 20), [{
    source_id: "source-one",
  }]);
  assert.match(DB.prepared[0].sql, /program\.review_status = 'catalog_listed'/);
  assert.match(DB.prepared[0].sql, /NOT EXISTS/);
  assert.match(DB.prepared[0].sql, /candidate\.extractor_version = 1/);
  assert.match(DB.prepared[0].sql, /ORDER BY snapshot\.fetched_at, snapshot\.id/);
  assert.deepEqual(DB.prepared[0].bindings, ["sasnb", 20]);
});

test("requirement candidate repository serializes immutable extraction output", async () => {
  const DB = fakeDatabase();
  const repository = createRequirementCandidateRepository({ DB }, { now: () => 5678 });
  const candidate = {
    source_id: "source-one",
    program_id: "program-one",
    source_url: "https://example.rutgers.edu/requirements",
    content_hash: "0123456789abcdef",
    extractor_version: 1,
    sections: [],
  };

  assert.deepEqual(await repository.saveCandidate(candidate), { changed: true });
  assert.match(DB.prepared[0].sql, /INSERT OR IGNORE INTO program_requirement_draft_candidates/);
  assert.deepEqual(DB.prepared[0].bindings, [
    "source-one",
    "program-one",
    "https://example.rutgers.edu/requirements",
    "0123456789abcdef",
    1,
    JSON.stringify(candidate),
    5678,
  ]);
});
