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

test("business scraping reads its official source URL from program data", async () => {
  const sourceUrl = "https://www.business.rutgers.edu/undergraduate-new-brunswick/example";
  const fetched = [];
  const saved = [];
  const service = createProgramScrapeService({
    repository: {
      async replaceRequirements(...args) {
        saved.push(args);
        return { groupsWritten: 1, coursesWritten: 1, notesWritten: 0 };
      },
    },
    recordScrape() {},
    fetchImpl: async (url) => {
      fetched.push(url);
      return {
        ok: true,
        async text() {
          return [
            "<table>",
            "<tr><th>Required courses</th></tr>",
            "<tr><th>Course</th><th>Credits</th><th>Notes</th></tr>",
            "<tr><td>33:123:101 Example</td><td>3</td><td></td></tr>",
            "</table>",
          ].join("");
        },
      };
    },
  });

  const program = { ...PROGRAM, id: "rbsnb-example", source_url: sourceUrl };
  const result = await service.scrapeBusinessProgram(program);

  assert.equal(result.ok, true);
  assert.deepEqual(fetched, [sourceUrl]);
  assert.equal(saved[0][0], program);
  assert.equal(saved[0][2], sourceUrl);
});

test("business scraping rejects missing or unsupported source data before network access", async () => {
  const service = createProgramScrapeService({
    repository: {},
    recordScrape() {},
    fetchImpl: async () => assert.fail("invalid sources must not be fetched"),
  });

  for (const source_url of [
    undefined,
    "http://www.business.rutgers.edu/undergraduate-new-brunswick/example",
    "https://example.com/undergraduate-new-brunswick/example",
    "https://www.business.rutgers.edu/graduate/example",
  ]) {
    const result = await service.scrapeBusinessProgram({
      ...PROGRAM,
      id: "rbsnb-example",
      source_url,
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /approved RBS requirements source URL/);
  }
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
