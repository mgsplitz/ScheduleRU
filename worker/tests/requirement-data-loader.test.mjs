import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL(
  "../../apps/web/src/requirement-data-loader.js",
  import.meta.url,
);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const createLoader = (request) => {
  assert.ok(
    context.globalThis.ScheduleRURequirementDataLoader,
    "requirement-data-loader.js must expose ScheduleRURequirementDataLoader",
  );
  return context.globalThis.ScheduleRURequirementDataLoader.create({ request });
};

test("school loading rejects an empty catalog and filters malformed profiles", async () => {
  const loader = createLoader(async () => ({
    schools: [null, {}, { slug: "" }, { slug: "rbsnb", name: "RBS" }],
  }));
  assert.deepEqual(plain(await loader.loadSchools()), [{ slug: "rbsnb", name: "RBS" }]);

  const emptyLoader = createLoader(async () => ({ schools: [{ name: "Missing slug" }] }));
  await assert.rejects(
    emptyLoader.loadSchools(),
    /Rutgers school profiles could not be loaded/,
  );
});

test("program loading keeps catalog scope separate from home-school policy scope", async () => {
  const requests = [];
  const loader = createLoader(async (path) => {
    requests.push(path);
    if (path === "/api/programs") return { programs: [{ id: "sas-econ" }] };
    if (path === "/api/programs?school=rbs%20nb") return { programs: [{ id: "rbs-finance" }] };
    if (path === "/api/program-selection-policies?home_school=rbs%20nb") return { limits: [{ max_selected: 3 }] };
    throw new Error(`unexpected request: ${path}`);
  });

  const all = await loader.loadPrograms({ homeSchoolSlug: "rbs nb", scope: "all" });
  const school = await loader.loadPrograms({ homeSchoolSlug: "rbs nb", scope: "school" });
  assert.deepEqual(plain(all.programs), [{ id: "sas-econ" }]);
  assert.deepEqual(plain(school.programs), [{ id: "rbs-finance" }]);
  assert.deepEqual(plain(all.selectionPolicies), { limits: [{ max_selected: 3 }] });
  assert.deepEqual(requests, [
    "/api/programs",
    "/api/program-selection-policies?home_school=rbs%20nb",
    "/api/programs?school=rbs%20nb",
    "/api/program-selection-policies?home_school=rbs%20nb",
  ]);
});

test("requirement loading deduplicates program IDs and returns every policy field", async () => {
  const requests = [];
  const loader = createLoader(async (path) => {
    requests.push(path);
    if (path === "/api/requirements?programs=finance%20major,cs-minor") {
      return {
        requirements: { "finance major": [{ id: "finance-root" }], "cs-minor": [{ id: "cs-root" }] },
        catalog_listed_program_ids: ["draft-minor"],
        double_count_rules: [{ id: 1 }],
        double_count_exceptions: [{ id: 2 }],
        eligibility_rules: [{ id: 3 }],
      };
    }
    if (path === "/api/double-count-policies?school=rbsnb") return { policies: [{ scope: "major_major" }] };
    throw new Error(`unexpected request: ${path}`);
  });

  const result = await loader.loadRequirements({
    programIds: ["finance major", "cs-minor", "finance major", ""],
    homeSchoolSlug: "rbsnb",
  });
  assert.deepEqual(plain(result), {
    programIds: ["finance major", "cs-minor"],
    requirements: { "finance major": [{ id: "finance-root" }], "cs-minor": [{ id: "cs-root" }] },
    catalogListedProgramIds: ["draft-minor"],
    doubleCountPolicies: [{ scope: "major_major" }],
    doubleCountRules: [{ id: 1 }],
    doubleCountExceptions: [{ id: 2 }],
    eligibilityRules: [{ id: 3 }],
  });
  assert.deepEqual(requests, [
    "/api/requirements?programs=finance%20major,cs-minor",
    "/api/double-count-policies?school=rbsnb",
  ]);
});

test("empty and single-program reference loads avoid unnecessary requirement requests", async () => {
  const requests = [];
  const loader = createLoader(async (path) => {
    requests.push(path);
    if (path === "/api/double-count-policies?school=sasnb") return { policies: [] };
    if (path === "/api/requirements?programs=one,two") return { requirements: { one: [], two: [] } };
    throw new Error(`unexpected request: ${path}`);
  });

  const empty = await loader.loadRequirements({ programIds: [], homeSchoolSlug: "sasnb" });
  assert.deepEqual(plain(empty.requirements), {});
  assert.deepEqual(plain(await loader.loadReferenceRequirements({ programIds: ["one"] })), {});
  assert.deepEqual(
    plain(await loader.loadReferenceRequirements({ programIds: ["one", "two", "one"] })),
    { one: [], two: [] },
  );
  assert.deepEqual(requests, [
    "/api/double-count-policies?school=sasnb",
    "/api/requirements?programs=one,two",
  ]);
});

test("Core loading resolves the first published curriculum and its requirement detail", async () => {
  const requests = [];
  const loader = createLoader(async (path) => {
    requests.push(path);
    if (path === "/api/core-curricula?school=sasnb") {
      return { curricula: [{ id: "sas-core", name: "SAS Core" }, { id: "other" }] };
    }
    if (path === "/api/programs/sas-core/requirements") return { requirements: [{ id: "core-root" }] };
    throw new Error(`unexpected request: ${path}`);
  });

  const result = await loader.loadCoreCurriculum({ homeSchoolSlug: "sasnb", label: "Core Curriculum" });
  assert.deepEqual(plain(result), {
    curricula: [{ id: "sas-core", name: "SAS Core" }, { id: "other" }],
    curriculum: { id: "sas-core", name: "SAS Core" },
    requirements: [{ id: "core-root" }],
  });
  assert.deepEqual(requests, [
    "/api/core-curricula?school=sasnb",
    "/api/programs/sas-core/requirements",
  ]);

  const missing = createLoader(async () => ({ curricula: [] }));
  await assert.rejects(
    missing.loadCoreCurriculum({ homeSchoolSlug: "sasnb", label: "Core Curriculum" }),
    /Core Curriculum could not be loaded/,
  );
});
