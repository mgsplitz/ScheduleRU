import assert from "node:assert/strict";
import test from "node:test";
import { createPublicProgramRepository } from "../../apps/api/src/programs/storage/public-program-repository.js";

function fakeDatabase(results = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, bindings: [] };
      calls.push(call);
      const statement = {
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
      };
      return statement;
    },
  };
}

test("public program repository applies reviewed visibility and query filters", async () => {
  const DB = fakeDatabase([{ id: "finance" }]);
  const repository = createPublicProgramRepository({ DB });

  assert.deepEqual(
    await repository.listReviewedPrograms({ school: "rbsnb", type: "major" }),
    [{ id: "finance" }],
  );
  assert.match(DB.calls[0].sql, /review_status = 'reviewed'/);
  assert.match(DB.calls[0].sql, /type NOT IN/);
  assert.deepEqual(DB.calls[0].bindings, ["rbsnb", "major"]);
});

test("public program repository avoids invalid empty IN queries", async () => {
  const DB = fakeDatabase();
  const repository = createPublicProgramRepository({ DB });

  assert.deepEqual(await repository.getDoubleCountData([]), {
    rules: [],
    exceptions: [],
  });
  assert.deepEqual(await repository.listReviewedProgramsByIds([]), []);
  assert.equal(DB.calls.length, 0);
});

test("public program repository supports unfiltered double-count policy reads", async () => {
  const DB = fakeDatabase([{ id: "default" }]);
  const repository = createPublicProgramRepository({ DB });

  assert.deepEqual(await repository.listDoubleCountPolicies(null), [{ id: "default" }]);
  assert.deepEqual(DB.calls[0].bindings, []);
});
