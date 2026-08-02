import assert from "node:assert/strict";
import test from "node:test";
import {
  createProgramScrapeRepository,
} from "../../apps/api/src/programs/storage/program-scrape-repository.js";

function fakeDatabase() {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      const call = { sql, bindings: [] };
      prepared.push(call);
      return {
        bind(...bindings) {
          call.bindings = bindings;
          return this;
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
}

test("scrape repository atomically replaces generated rows and preserves counts", async () => {
  const DB = fakeDatabase();
  const repository = createProgramScrapeRepository({ DB }, { now: () => 5678 });
  const sections = [{
    name: "Required",
    rule: "all",
    count: null,
    courseItems: [{ code: "01:123:101", title: "Example", credits: "3" }],
    subgroups: [],
    orGroups: [],
    prose: ["Confirm with advising."],
  }];

  assert.deepEqual(
    await repository.replaceRequirements(
      { id: "program-one" },
      sections,
      "https://example.rutgers.edu/program",
    ),
    { groupsWritten: 1, coursesWritten: 1, notesWritten: 1 },
  );
  assert.equal(DB.batches.length, 1);
  assert.match(DB.prepared[0].sql, /DELETE FROM requirement_courses/);
  assert.match(DB.prepared.at(-1).sql, /review_status = 'unreviewed'/);
  assert.deepEqual(DB.prepared.at(-1).bindings, [
    5678,
    "https://example.rutgers.edu/program",
    "program-one",
  ]);
});

test("scrape repository counts nested, alternative, and external notes generically", async () => {
  const DB = fakeDatabase();
  const repository = createProgramScrapeRepository({ DB });
  const sections = [{
    name: "Options",
    courseItems: [],
    subgroups: [{
      name: "Advanced",
      courseItems: [{ code: "01:123:301" }],
    }],
    orGroups: [[{ code: "01:123:201" }, { code: "01:123:202" }]],
    prose: [],
  }];

  assert.deepEqual(
    await repository.replaceRequirements(
      { id: "program-one" },
      sections,
      "https://example.rutgers.edu/program",
      [{ section_name: "Policy", raw_text: "One note." }],
    ),
    { groupsWritten: 3, coursesWritten: 3, notesWritten: 1 },
  );
});
