import assert from "node:assert/strict";
import test from "node:test";
import {
  createProgramScrapeService,
} from "../../apps/api/src/programs/services/program-scrape-service.js";

const PROGRAM = {
  id: "sasnb-example",
  name: "Example",
  school_slug: "sasnb",
  program_slug: "example",
};

test("catalog scraping parses and persists requirements without owning D1", async () => {
  const saved = [];
  const events = [];
  const service = createProgramScrapeService({
    repository: {
      async replaceRequirements(...args) {
        saved.push(args);
        return { groupsWritten: 1, coursesWritten: 1, notesWritten: 0 };
      },
    },
    recordScrape: (...args) => events.push(args),
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return "<h2>Required Courses</h2><p>01:123:101 Example Course</p>";
      },
    }),
    catalogSubdomain: "catalog",
  });

  assert.deepEqual(await service.scrapeCatalogProgram(PROGRAM), {
    ok: true,
    groupsWritten: 1,
    coursesWritten: 1,
    notesWritten: 0,
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0], PROGRAM);
  assert.equal(events[0][1], "ok");
});

test("catalog scraping records fetch failures without invoking persistence", async () => {
  const events = [];
  const service = createProgramScrapeService({
    repository: {
      replaceRequirements() {
        assert.fail("failed fetch must not write");
      },
    },
    recordScrape: (...args) => events.push(args),
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });

  assert.deepEqual(await service.scrapeCatalogProgram(PROGRAM), {
    ok: false,
    error: "HTTP 503",
  });
  assert.equal(events[0][1], "error");
});

test("business scraping rejects unknown program mappings before network access", async () => {
  const service = createProgramScrapeService({
    repository: {},
    recordScrape() {},
    fetchImpl: async () => assert.fail("unknown programs must not be fetched"),
  });

  const result = await service.scrapeBusinessProgram({ ...PROGRAM, id: "rbsnb-unknown" });
  assert.equal(result.ok, false);
  assert.match(result.error, /no BIZ_SLUG_MAP entry/);
});

test("catalog discovery deduplicates stable program identities", async () => {
  const service = createProgramScrapeService({
    repository: {},
    recordScrape() {},
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return [
          '<a href="/schools/sasnb/degree-requirements/programs-majors-minors/example">Example</a>',
          '<a href="/schools/sasnb/degree-requirements/programs-majors-minors/example">Duplicate</a>',
        ].join("");
      },
    }),
    catalogSubdomain: "catalog",
  });

  assert.deepEqual(await service.discoverPrograms("sasnb", "/programs"), {
    ok: true,
    found: [{
      school_slug: "sasnb",
      program_slug: "example",
      name: "Example",
    }],
  });
});
