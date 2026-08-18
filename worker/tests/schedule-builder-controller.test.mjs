import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/schedule-builder-controller.js", import.meta.url);
const context = { globalThis: {}, encodeURIComponent };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function controllers() {
  assert.ok(
    context.globalThis.ScheduleRUScheduleBuilderController,
    "schedule-builder-controller.js must expose ScheduleRUScheduleBuilderController",
  );
  return context.globalThis.ScheduleRUScheduleBuilderController;
}

function fixture() {
  const state = { year: 1, schedule: {}, builder: null };
  const calls = { renderMain: 0, renderAll: 0, permutations: 0, modals: [] };
  const controller = controllers().create({
    getState: () => state,
    currentPlannerTerm: () => ({ year: 1, semester: "fall" }),
    canOpenBuilder: ({ displayedYear, activeYear, semester, activeSemester }) =>
      displayedYear === activeYear && semester === activeSemester,
    buildPermutations: (pool) => {
      calls.permutations += 1;
      return {
        combos: pool.length ? [[{ code: pool[0].code, index_number: "10001", meetings: [] }]] : [],
        blockers: [],
        required: pool,
      };
    },
    renderMain: () => { calls.renderMain += 1; },
    renderAll: () => { calls.renderAll += 1; },
    showModal: (options) => calls.modals.push(options),
    courseRecordFromId: (id) => ({ id, code: id, title: id, credits: 3 }),
    lockedElsewhere: () => false,
    request: async () => ({ sections: [] }),
    activeBackendYear: () => "2026",
    activeBackendTerm: () => "9",
    academicYearLabel: (year) => `${year}st Year`,
    escapeHtml: (value) => String(value),
    userMessageModel: { presentIssue: () => ({ message: "Schedule data is unavailable." }) },
  });
  return { controller, state, calls };
}

test("the builder opens only for the active registration term", () => {
  const app = fixture();

  assert.equal(app.controller.open("spring"), false);
  assert.equal(app.state.builder, null);
  assert.equal(app.controller.open("fall"), true);
  assert.equal(app.state.builder.pool.length, 0);
  assert.equal(app.calls.renderMain, 1);
});

test("recomputation assigns stable assistant-facing schedule numbers", () => {
  const app = fixture();
  app.controller.open("fall");
  app.state.builder.pool = [{ code: "01:198:111", enabled: true }];

  app.controller.recompute();

  assert.equal(app.state.builder.permutations[0].stableIndex, 1);
  assert.equal(app.state.builder.requiredCount, 1);
});

test("including closed sections is reversible without losing manual choices", () => {
  const app = fixture();
  app.controller.open("fall");
  app.state.builder.pool = [{
    code: "01:198:111",
    checked: new Set(["open", "manual-closed"]),
    sections: [
      { index_number: "open", open_status: true },
      { index_number: "manual-closed", open_status: false },
      { index_number: "auto-closed", open_status: false },
    ],
  }];

  app.controller.setIncludeClosed(true);
  assert.deepEqual([...app.state.builder.pool[0].checked].sort(), ["auto-closed", "manual-closed", "open"]);
  app.controller.setIncludeClosed(false);

  assert.deepEqual([...app.state.builder.pool[0].checked].sort(), ["manual-closed", "open"]);
  assert.equal(app.state.builder.includeClosed, false);
});

test("confirming a permutation writes one pinned semester schedule and exits", () => {
  const app = fixture();
  app.controller.open("fall");
  app.state.builder.permutations = [[{
    code: "01:198:111", title: "Intro Computer Science", credits: 4,
    index_number: "12345", section_number: "01", meetings: [],
  }]];

  assert.equal(app.controller.confirm(), true);

  assert.equal(app.state.schedule["01:198:111"].year, 1);
  assert.equal(app.state.schedule["01:198:111"].sem, "fall");
  assert.equal(app.state.schedule["01:198:111"].userPinned, true);
  assert.equal(app.state.builder, null);
  assert.equal(app.calls.renderAll, 1);
});
