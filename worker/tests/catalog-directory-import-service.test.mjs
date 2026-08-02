import assert from "node:assert/strict";
import test from "node:test";
import {
  createCatalogDirectoryImportService,
} from "../../apps/api/src/programs/services/catalog-directory-import-service.js";

function source() {
  return {
    id: "sas-program-directory",
    school_slug: "sasnb",
    directory_url: "https://example.rutgers.edu/programs",
    profile_path: "/profiles/",
    catalog_year: "2026",
    adapter: "html_program_directory_v1",
    owner_labels_json: "[]",
  };
}

test("catalog directory service imports parsed entries under a source lease", async () => {
  const calls = [];
  const repository = {
    async findEnabledSource() {
      return source();
    },
    async listIdentityOverrides() {
      return [{
        program_slug: "economics",
        type: "major",
        program_id: "sasnb-economics-major",
      }];
    },
    async acquireImportLease(...args) {
      calls.push(["lease", ...args]);
      return true;
    },
    async replaceEntries(storedSource, entries, token) {
      calls.push(["replace", storedSource, entries, token]);
    },
    async failImport() {
      throw new Error("unexpected failure");
    },
  };
  const scrapeEvents = [];
  const service = createCatalogDirectoryImportService({
    repository,
    recordScrape: (...args) => scrapeEvents.push(args),
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return '<a href="/profiles/economics" title="Economics (Major) | B.A.">Economics</a>';
      },
    }),
    now: () => 1234,
    createToken: () => "lease-token",
  });

  assert.deepEqual(await service.importSource("sas-program-directory"), {
    ok: true,
    source_id: "sas-program-directory",
    programs_imported: 1,
  });
  assert.deepEqual(calls[0], [
    "lease",
    "sas-program-directory",
    "lease-token",
    1234,
  ]);
  assert.equal(calls[1][0], "replace");
  assert.equal(calls[1][2][0].id, "sasnb-economics-major");
  assert.equal(calls[1][3], "lease-token");
  assert.equal(scrapeEvents[0][1], "ok");
});

test("catalog directory service does not fetch while another import owns the lease", async () => {
  let fetched = false;
  const service = createCatalogDirectoryImportService({
    repository: {
      async findEnabledSource() {
        return source();
      },
      async listIdentityOverrides() {
        return [];
      },
      async acquireImportLease() {
        return false;
      },
    },
    recordScrape() {},
    fetchImpl: async () => {
      fetched = true;
      throw new Error("must not fetch");
    },
    now: () => 1234,
    createToken: () => "lease-token",
  });

  const result = await service.importSource("sas-program-directory");
  assert.equal(result.status, 409);
  assert.equal(fetched, false);
});

test("catalog directory service releases its lease and records failed imports", async () => {
  const failures = [];
  const scrapeEvents = [];
  const service = createCatalogDirectoryImportService({
    repository: {
      async findEnabledSource() {
        return source();
      },
      async listIdentityOverrides() {
        return [];
      },
      async acquireImportLease() {
        return true;
      },
      async failImport(...args) {
        failures.push(args);
      },
    },
    recordScrape: (...args) => scrapeEvents.push(args),
    fetchImpl: async () => ({ ok: false, status: 503 }),
    now: () => 1234,
    createToken: () => "lease-token",
  });

  assert.deepEqual(await service.importSource("sas-program-directory"), {
    ok: false,
    source_id: "sas-program-directory",
    error: "HTTP 503",
  });
  assert.deepEqual(failures, [[
    "sas-program-directory",
    "lease-token",
    "HTTP 503",
  ]]);
  assert.equal(scrapeEvents[0][1], "error");
});
