import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/home-school-transaction.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function transactions() {
  assert.ok(
    context.globalThis.ScheduleRUHomeSchoolTransaction,
    "home-school-transaction.js must expose ScheduleRUHomeSchoolTransaction",
  );
  return context.globalThis.ScheduleRUHomeSchoolTransaction;
}
const plain = (value) => JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a failed replacement restores the accepted academic context without touching the semester plan", async () => {
  const state = {
    homeSchoolSlug: "sasnb",
    selectedPrograms: ["sas-major"],
    groupSelections: { writing: ["01:355:101"] },
    requirementTrees: { "sas-major": ["tree"] },
    majorRequirementTree: { id: "sas-tree" },
    coreRequirementTree: { id: "sas-core" },
    schedule: { "01:355:101": { code: "01:355:101", year: 1, sem: "fall" } },
    homeSchoolChangeGeneration: 0,
  };
  const loading = [];
  const appliedTrees = [];
  const failures = [];
  let saves = 0;
  const model = transactions().create({
    getState: () => state,
    loadCandidate: async () => { throw new Error("offline"); },
    applyRequirementTree: (tree) => appliedTrees.push(tree),
    saveState: () => { saves += 1; },
    onCommitted: () => {},
    onRolledBack: (error) => failures.push(error.message),
    onLoadingChange: (value) => loading.push(value),
  });

  const result = await model.execute({ slug: "rbsnb" });

  assert.equal(result.status, "rolled_back");
  assert.equal(state.homeSchoolSlug, "sasnb");
  assert.deepEqual(state.selectedPrograms, ["sas-major"]);
  assert.deepEqual(state.groupSelections, { writing: ["01:355:101"] });
  assert.equal(state.schedule["01:355:101"].year, 1);
  assert.equal(state.requirementsLoading, false);
  assert.deepEqual(plain(appliedTrees), [{ id: "sas-tree" }]);
  assert.deepEqual(failures, ["offline"]);
  assert.deepEqual(loading, [true, false]);
  assert.equal(saves, 0);
});

test("a newer school change discards stale success and commits only the latest candidate", async () => {
  const state = {
    homeSchoolSlug: "sasnb",
    selectedPrograms: ["sas-major"],
    majorRequirementTree: { id: "sas-tree" },
    schedule: {},
    homeSchoolChangeGeneration: 0,
  };
  const requests = new Map();
  const commits = [];
  const loading = [];
  let saves = 0;
  const model = transactions().create({
    getState: () => state,
    loadCandidate: (school) => {
      const request = deferred();
      requests.set(school.slug, request);
      return request.promise;
    },
    applyRequirementTree: () => {},
    saveState: () => { saves += 1; },
    onCommitted: (candidate) => commits.push(candidate.homeSchoolSlug),
    onRolledBack: () => {},
    onLoadingChange: (value) => loading.push(value),
  });

  const first = model.execute({ slug: "rbsnb" });
  const second = model.execute({ slug: "sebs" });
  requests.get("rbsnb").resolve({
    homeSchoolSlug: "rbsnb",
    selectedPrograms: ["rbs-major"],
    majorRequirementTree: { id: "rbs-tree" },
  });
  assert.equal((await first).status, "stale");
  assert.equal(state.homeSchoolSlug, "sasnb");

  requests.get("sebs").resolve({
    homeSchoolSlug: "sebs",
    selectedPrograms: ["sebs-major"],
    majorRequirementTree: { id: "sebs-tree" },
  });
  assert.equal((await second).status, "committed");
  assert.equal(state.homeSchoolSlug, "sebs");
  assert.deepEqual(state.selectedPrograms, ["sebs-major"]);
  assert.deepEqual(commits, ["sebs"]);
  assert.equal(saves, 1);
  assert.deepEqual(loading, [true, true, false]);
});
