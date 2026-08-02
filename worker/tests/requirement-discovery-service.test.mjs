import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequirementDiscoveryService,
} from "../../apps/api/src/programs/services/requirement-discovery-service.js";

const PROFILE = {
  id: "requirements-sasnb-example-major",
  program_id: "sasnb-example-major",
  school_slug: "sasnb",
  source_url: "https://example.rutgers.edu/profile",
  source_title: "Example profile",
  adapter: "html_requirement_source_v1",
};

test("requirement discovery stores an explicitly labelled official major page", async () => {
  const saved = [];
  const waits = [];
  const service = createRequirementDiscoveryService({
    repository: {
      async saveProfileDetail(...args) {
        saved.push(args);
      },
    },
    recordScrape() {},
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return '<a href="https://example.rutgers.edu/major">Major Web Page</a>';
      },
    }),
    wait: async (milliseconds) => waits.push(milliseconds),
  });

  assert.deepEqual(await service.discoverProfiles([PROFILE]), [{
    ok: true,
    source_id: PROFILE.id,
    program_id: PROFILE.program_id,
  }]);
  assert.equal(saved[0][1].source_url, "https://example.rutgers.edu/major");
  assert.deepEqual(waits, [100]);
});

test("requirement discovery records profile failures and continues the batch", async () => {
  const errors = [];
  const service = createRequirementDiscoveryService({
    repository: {
      async markSourceError(...args) {
        errors.push(args);
      },
    },
    recordScrape() {},
    fetchImpl: async () => ({ ok: false, status: 503 }),
    wait: async () => {},
  });

  const results = await service.discoverProfiles([PROFILE]);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].error, "HTTP 503");
  assert.deepEqual(errors, [[PROFILE.id, "HTTP 503"]]);
});

test("nested discovery records both explicit links and definitive no-link results", async () => {
  const attempts = [];
  const nested = [];
  const sources = [
    { ...PROFILE, id: "detail-found", source_url: "https://example.rutgers.edu/found" },
    { ...PROFILE, id: "detail-none", source_url: "https://example.rutgers.edu/none" },
  ];
  const service = createRequirementDiscoveryService({
    repository: {
      async saveNestedDetail(...args) {
        nested.push(args);
      },
      async recordNestedAttempt(...args) {
        attempts.push(args);
      },
    },
    recordScrape() {},
    fetchImpl: async (url) => ({
      ok: true,
      async text() {
        return url.endsWith("/found")
          ? '<a href="/major-requirements">Major Requirements</a>'
          : "<main>Advising information</main>";
      },
    }),
    wait: async () => {},
  });

  const results = await service.discoverNestedDetails(sources);
  assert.deepEqual(results.map(({ found }) => found), [true, false]);
  assert.equal(nested.length, 1);
  assert.equal(attempts[0][1], "found");
  assert.equal(attempts[1][1], "no_link");
});

test("discovery queue validation fails before storage access", async () => {
  const service = createRequirementDiscoveryService({
    repository: {
      listPendingProfiles() {
        assert.fail("invalid school must not reach storage");
      },
      listPendingNestedDetails() {
        assert.fail("unsupported school must not reach storage");
      },
    },
    recordScrape() {},
  });

  assert.throws(() => service.listPendingProfiles("../sas", 20), /valid school slug/);
  assert.throws(
    () => service.listPendingNestedDetails("rbsnb", 20),
    /supports school=sasnb majors only/,
  );
});
