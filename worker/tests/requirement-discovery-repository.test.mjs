import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequirementDiscoveryRepository,
} from "../../apps/api/src/programs/storage/requirement-discovery-repository.js";

function fakeDatabase(results = []) {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      const call = { sql, bindings: [] };
      prepared.push(call);
      const statement = {
        bind(...bindings) {
          call.bindings = bindings;
          return statement;
        },
        async all() {
          return { results };
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
}

test("discovery repository registers safe catalog major profiles in one storage boundary", async () => {
  const DB = fakeDatabase([
    {
      id: "sasnb-example-major",
      name: "Example",
      school_slug: "sasnb",
      source_url: "https://example.rutgers.edu/profile",
    },
    {
      id: "../unsafe",
      name: "Unsafe",
      school_slug: "sasnb",
      source_url: "https://example.rutgers.edu/unsafe",
    },
  ]);
  const repository = createRequirementDiscoveryRepository({ DB });

  assert.equal(await repository.registerProfileSources("sasnb"), 1);
  assert.match(DB.prepared[0].sql, /review_status = 'catalog_listed'/);
  assert.equal(DB.batches[0].length, 1);
  assert.deepEqual(DB.prepared[1].bindings.slice(0, 2), [
    "requirements-sasnb-example-major",
    "sasnb-example-major",
  ]);
});

test("discovery repository owns stable profile and nested queues", async () => {
  const DB = fakeDatabase([{ id: "source-one" }]);
  const repository = createRequirementDiscoveryRepository({ DB });

  assert.deepEqual(await repository.listPendingProfiles("sasnb", 20), [{ id: "source-one" }]);
  assert.match(DB.prepared[0].sql, /source\.source_kind = 'profile'/);
  assert.match(DB.prepared[0].sql, /NOT EXISTS/);
  assert.deepEqual(DB.prepared[0].bindings, ["sasnb", 20]);

  assert.deepEqual(await repository.listPendingNestedDetails("sasnb", 10), [{ id: "source-one" }]);
  assert.match(DB.prepared[1].sql, /source\.id LIKE 'detail-%'/);
  assert.match(DB.prepared[1].sql, /json_array_length/);
  assert.deepEqual(DB.prepared[1].bindings, ["sasnb", 10]);
});

test("discovery repository records nested evidence with an injected timestamp", async () => {
  const DB = fakeDatabase();
  const repository = createRequirementDiscoveryRepository({ DB }, { now: () => 5678 });
  const source = { id: "detail-one", program_id: "program-one" };

  await repository.recordNestedAttempt(
    source,
    "found",
    "https://example.rutgers.edu/requirements",
    "saved",
  );
  assert.match(DB.prepared[0].sql, /program_requirement_source_discovery_attempts/);
  assert.deepEqual(DB.prepared[0].bindings, [
    "detail-one",
    "program-one",
    "found",
    "https://example.rutgers.edu/requirements",
    5678,
    "saved",
  ]);
});
