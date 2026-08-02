import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequirementImportService,
  requirementSourceImportBatchLimit,
} from "../../apps/api/src/programs/services/requirement-import-service.js";

const SOURCE = {
  id: "requirements-sasnb-example-major",
  program_id: "sasnb-example-major",
  school_slug: "sasnb",
  source_url: "https://example.rutgers.edu/requirements",
  source_title: "Example Requirements",
  adapter: "html_requirement_source_v1",
};

test("requirement import service stores source snapshots without publishing audits", async () => {
  const snapshots = [];
  const scrapeEvents = [];
  const service = createRequirementImportService({
    repository: {
      async findEnabledSource() {
        return SOURCE;
      },
      async saveSnapshot(snapshot) {
        snapshots.push(snapshot);
        return { changed: true };
      },
      async markFailure() {
        throw new Error("unexpected failure");
      },
    },
    recordScrape: (...args) => scrapeEvents.push(args),
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return "<main><h1>Example Requirements</h1><p>Complete 01:123:101.</p></main>";
      },
    }),
  });

  const result = await service.importSource(SOURCE.id);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.courses_found, 1);
  assert.equal(snapshots.length, 1);
  assert.equal("review_status" in snapshots[0], false);
  assert.equal(scrapeEvents[0][1], "ok");
});

test("requirement import service records source failures without throwing away batch progress", async () => {
  const failures = [];
  const service = createRequirementImportService({
    repository: {
      async findEnabledSource() {
        return SOURCE;
      },
      async markFailure(...args) {
        failures.push(args);
      },
    },
    recordScrape() {},
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });

  assert.deepEqual(await service.importSource(SOURCE.id), {
    ok: false,
    source_id: SOURCE.id,
    program_id: SOURCE.program_id,
    error: "HTTP 503",
  });
  assert.deepEqual(failures, [[SOURCE.id, "HTTP 503"]]);
});

test("requirement import batches remain bounded and politely sequenced", async () => {
  const waits = [];
  const repository = {
    async findEnabledSource(sourceId) {
      return { ...SOURCE, id: sourceId };
    },
    async saveSnapshot() {
      return { changed: false };
    },
  };
  const service = createRequirementImportService({
    repository,
    recordScrape() {},
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return "<main><p>01:123:101</p></main>";
      },
    }),
    wait: async (milliseconds) => waits.push(milliseconds),
  });

  const results = await service.importBatch([{ id: "source-one" }, { id: "source-two" }]);
  assert.equal(results.length, 2);
  assert.deepEqual(waits, [100, 100]);
  assert.equal(requirementSourceImportBatchLimit("0"), 1);
  assert.equal(requirementSourceImportBatchLimit("999"), 25);
  assert.equal(requirementSourceImportBatchLimit("invalid"), 20);
});
