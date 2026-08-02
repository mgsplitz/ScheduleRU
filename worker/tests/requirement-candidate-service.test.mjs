import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequirementCandidateService,
} from "../../apps/api/src/programs/services/requirement-candidate-service.js";

const SNAPSHOT = {
  source_id: "requirements-sasnb-example-major",
  program_id: "sasnb-example-major",
  source_url: "https://example.rutgers.edu/requirements",
  content_hash: "0123456789abcdef",
  content_text: [
    "Example Major",
    "Required courses",
    "Complete 01:123:101 and 01:123:102.",
  ].join("\n"),
  parsed_json: JSON.stringify({
    version: 1,
    headings: ["Example Major", "Required courses"],
    course_codes: ["01:123:101", "01:123:102"],
  }),
};

test("requirement candidate service stores source-derived sections without publishing rules", async () => {
  const saved = [];
  const scrapeEvents = [];
  const service = createRequirementCandidateService({
    repository: {
      async saveCandidate(candidate) {
        saved.push(candidate);
        return { changed: true };
      },
    },
    recordScrape: (...args) => scrapeEvents.push(args),
  });

  assert.deepEqual(await service.extractBatch([SNAPSHOT]), [{
    ok: true,
    source_id: SNAPSHOT.source_id,
    program_id: SNAPSHOT.program_id,
    changed: true,
    sections_found: 1,
    courses_found: 2,
  }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].sections[0].heading, "Required courses");
  assert.equal("review_status" in saved[0], false);
  assert.equal("rule" in saved[0].sections[0], false);
  assert.equal(scrapeEvents[0][1], "ok");
});

test("requirement candidate service records one failure without discarding batch progress", async () => {
  const scrapeEvents = [];
  const service = createRequirementCandidateService({
    repository: {
      async saveCandidate(candidate) {
        if (candidate.source_id === "broken") throw new Error("database unavailable");
        return { changed: false };
      },
    },
    recordScrape: (...args) => scrapeEvents.push(args),
  });

  const results = await service.extractBatch([
    { ...SNAPSHOT, source_id: "broken" },
    { ...SNAPSHOT, source_id: "working" },
  ]);
  assert.equal(results[0].ok, false);
  assert.match(results[0].error, /database unavailable/);
  assert.equal(results[1].ok, true);
  assert.equal(scrapeEvents[0][1], "error");
  assert.equal(scrapeEvents[1][1], "ok");
});

test("requirement candidate service limits automated extraction to the supported catalog", async () => {
  const service = createRequirementCandidateService({
    repository: {
      listPendingSnapshots() {
        assert.fail("unsupported catalogs must not reach storage");
      },
    },
    recordScrape() {},
  });

  assert.throws(
    () => service.listPendingSnapshots("rbsnb", 20),
    /supports school=sasnb majors only/,
  );
});
