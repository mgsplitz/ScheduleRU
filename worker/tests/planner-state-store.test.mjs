import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const stateLogicUrl = new URL(
  "../../packages/planner/src/planner-state-logic.js",
  import.meta.url,
);
const stateStoreUrl = new URL(
  "../../apps/web/src/planner-state-store.js",
  import.meta.url,
);

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(stateLogicUrl, "utf8"), context);
if (fs.existsSync(stateStoreUrl)) {
  vm.runInNewContext(fs.readFileSync(stateStoreUrl, "utf8"), context);
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const memoryStorage = (initial = null) => {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { value = null; },
    value: () => value,
  };
};
const stateStore = () => {
  assert.ok(
    context.globalThis.ScheduleRUPlannerStateStore,
    "planner-state-store.js must expose ScheduleRUPlannerStateStore",
  );
  return context.globalThis.ScheduleRUPlannerStateStore;
};
const load = (storage) => stateStore().load({
  storage,
  currentVersion: context.globalThis.ScheduleRUPlannerStateLogic.STATE_VERSION,
  migrate: context.globalThis.ScheduleRUPlannerStateLogic.migratePlannerState,
});

test("round-trips the complete device-local planner state without runtime-only data", () => {
  const storage = memoryStorage();
  const state = {
    apOn: { calc: true },
    completed: { "01:198:111": true },
    schedule: { "01:198:111": { code: "01:198:111", year: 1, sem: "fall", userPinned: true } },
    wishlist: { "01:198:112": true },
    groupSelections: { core: ["01:198:111"] },
    creditLedger: { transfer: 3 },
    year: 2,
    homeSchoolSlug: "rbs-new-brunswick",
    selectedPrograms: ["bait-major", "finance-major"],
    onboarding: { completed: true, step: 4 },
    academicPosition: { year: 2, startingSemester: "fall" },
    academicRecords: [],
    academicCalendarStartYear: 2025,
    primaryProgramId: "bait-major",
    secondaryProgramId: "finance-major",
    programSelectionConfirmed: true,
    generatedPlanPreview: null,
    schedulePreferences: { "2:fall": { version: 1, constraints: [] } },
    planPlaceholders: [{ id: "core-slot", year: 2, sem: "fall" }],
    issueDismissals: { notice: true },
    activeRequirementChoice: {
      version: 1,
      placeholderId: "core-slot",
      requirementGroupId: "core-wcr",
      label: "Revision-Based Writing [WCr]",
      memberCourseCodes: ["01:355:201"],
      selectors: [],
      returnPage: "nav",
      returnPlacement: { year: 2, sem: "fall" },
    },
    backendCourses: [{ code: "must-not-persist" }],
  };

  assert.equal(stateStore().save({ storage, state, currentVersion: 5, now: () => 1234 }), true);
  const serialized = JSON.parse(storage.value());
  assert.equal(serialized.version, 5);
  assert.equal(serialized.savedAt, 1234);
  assert.equal("backendCourses" in serialized, false);

  const restored = plain(load(storage));
  assert.deepEqual(restored.selectedPrograms, ["bait-major", "finance-major"]);
  assert.equal(restored.schedule["01:198:111"].userPinned, true);
  assert.equal(restored.year, 2);
  assert.equal(restored.homeSchoolSlug, "rbs-new-brunswick");
  assert.deepEqual(restored.planPlaceholders, [{ id: "core-slot", year: 2, sem: "fall" }]);
  assert.equal(restored.activeRequirementChoice.requirementGroupId, "core-wcr");
});

test("loads supported legacy state while sanitizing browser-controlled fields", () => {
  const storage = memoryStorage(JSON.stringify({
    version: 1,
    apOn: ["not", "a", "map"],
    completed: { "01:198:111": true },
    schedule: null,
    wishlist: "invalid",
    groupSelections: {},
    creditLedger: {},
    year: 99,
    homeSchoolSlug: "../../invalid",
    selectedPrograms: ["cs-minor", 42, null],
  }));

  const restored = plain(load(storage));
  assert.equal(restored.version, 5);
  assert.deepEqual(restored.apOn, {});
  assert.deepEqual(restored.completed, { "01:198:111": true });
  assert.deepEqual(restored.schedule, {});
  assert.deepEqual(restored.wishlist, {});
  assert.equal("year" in restored, false);
  assert.equal("homeSchoolSlug" in restored, false);
  assert.deepEqual(restored.selectedPrograms, ["cs-minor"]);
});

test("ignores malformed, unknown, and inaccessible saved state", () => {
  assert.equal(load(memoryStorage("{broken json")), null);
  assert.equal(load(memoryStorage(JSON.stringify({ version: 999, schedule: {} }))), null);
  assert.equal(load({ getItem: () => { throw new Error("blocked"); } }), null);
});

test("storage failures never interrupt an active planning session", () => {
  const blocked = {
    getItem: () => null,
    setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(stateStore().save({ storage: blocked, state: {}, currentVersion: 5 }), false);
  assert.equal(stateStore().clear({ storage: blocked }), false);
  assert.equal(stateStore().save({ storage: null, state: {}, currentVersion: 5 }), false);
  assert.equal(stateStore().clear({ storage: null }), false);
});

test("clear removes only the planner state key", () => {
  const removed = [];
  assert.equal(stateStore().clear({ storage: { removeItem: (key) => removed.push(key) } }), true);
  assert.deepEqual(removed, ["scheduleru_planner_state_v1"]);
});
