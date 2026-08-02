import assert from "node:assert/strict";
import test from "node:test";
import { createAdminProgramRepository } from "../../apps/api/src/programs/storage/admin-program-repository.js";

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
        call,
        bind(...bindings) {
          call.bindings = bindings;
          return statement;
        },
        async all() {
          return { results };
        },
        async first() {
          return results[0] || null;
        },
        async run() {
          return { success: true };
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

test("admin program repository owns deterministic program upserts", async () => {
  const DB = fakeDatabase();
  const repository = createAdminProgramRepository({ DB });

  await repository.seedPrograms([{
    id: "sasnb-example-major",
    name: "Example",
    school_slug: "sasnb",
    program_slug: "example",
    type: "major",
  }]);

  assert.equal(DB.batches.length, 1);
  assert.match(DB.batches[0][0].sql, /INSERT INTO programs/);
  assert.match(DB.batches[0][0].sql, /ON CONFLICT\(id\) DO UPDATE/);
  assert.deepEqual(DB.batches[0][0].bindings.slice(0, 5), [
    "sasnb-example-major",
    "Example",
    "sasnb",
    "example",
    "major",
  ]);
});

test("admin program repository keeps group and course persistence together", async () => {
  const DB = fakeDatabase();
  const repository = createAdminProgramRepository({ DB });

  await repository.saveRequirementGroup({
    program_id: "sasnb-example-major",
    name: "Core",
    rule: "all",
    courses: ["01:198:111", "01:198:112"],
  }, "sasnb-example-major-core");

  assert.match(DB.prepared[0].sql, /INSERT INTO requirement_groups/);
  assert.equal(DB.batches[0].length, 2);
  assert.deepEqual(
    DB.batches[0].map((statement) => statement.bindings[1]),
    ["01:198:111", "01:198:112"],
  );
});

test("admin program repository deletes course rows before their groups", async () => {
  const DB = fakeDatabase();
  const repository = createAdminProgramRepository({ DB });

  await repository.deleteRequirementGroups(["parent", "child"]);

  assert.equal(DB.batches[0].length, 4);
  assert.match(DB.batches[0][0].sql, /DELETE FROM requirement_courses/);
  assert.match(DB.batches[0][1].sql, /DELETE FROM requirement_groups/);
  assert.deepEqual(DB.batches[0].map((statement) => statement.bindings[0]), [
    "parent",
    "parent",
    "child",
    "child",
  ]);
});
