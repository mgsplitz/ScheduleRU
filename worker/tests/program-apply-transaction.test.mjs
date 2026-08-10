import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/program-apply-transaction.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function transactions() {
  assert.ok(
    context.globalThis.ScheduleRUProgramApplyTransaction,
    "program-apply-transaction.js must expose ScheduleRUProgramApplyTransaction",
  );
  return context.globalThis.ScheduleRUProgramApplyTransaction;
}

const programs = [
  { id: "bait", type: "major" },
  { id: "finance", type: "major" },
  { id: "cs", type: "minor" },
  { id: "math", type: "minor" },
];
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness(overrides = {}) {
  const state = {
    availablePrograms: programs,
    selectedPrograms: ["bait"],
    primaryProgramId: "bait",
    secondaryProgramId: null,
    requiredProgramTab: "bait",
    programApplyGeneration: 0,
    programApplyPending: false,
    requirementsLoading: false,
    programSelectionConfirmed: false,
  };
  const pending = [];
  const loading = [];
  const feedback = [];
  const warnings = [];
  const committed = [];
  let saves = 0;
  const model = transactions().create({
    getState: () => state,
    checkSelection: async () => ({ allowed: true, warnings: [] }),
    loadCandidate: async (ids) => ({
      selectedPrograms: ids,
      requirementTrees: Object.fromEntries(ids.map((id) => [id, []])),
      majorRequirementTree: { id: ids.join("+") },
    }),
    programDraftView: ({ draftIds, primaryId }) => ({
      selectedIds: draftIds,
      majorIds: draftIds.filter((id) => programs.find((program) => program.id === id)?.type === "major"),
      primaryId,
      secondaryId: draftIds.find((id) => id !== primaryId && programs.find((program) => program.id === id)?.type === "major") || null,
    }),
    applyRequirementTree: () => {},
    saveState: () => { saves += 1; },
    onPendingChange: (value) => pending.push(value),
    onLoadingChange: (value) => loading.push(value),
    onFeedback: (value) => feedback.push(value),
    onWarnings: (value) => warnings.push(value),
    onCommitted: (candidate) => committed.push(candidate),
    ...overrides,
  });
  return { state, model, pending, loading, feedback, warnings, committed, saves: () => saves };
}

test("draft validation requires one or two majors before any policy request", async () => {
  let checks = 0;
  const app = harness({ checkSelection: async () => { checks += 1; return { allowed: true }; } });

  assert.equal((await app.model.execute({ ids: ["cs"] })).status, "invalid");
  assert.match(app.feedback[0].errors[0].message, /primary major/i);
  app.state.availablePrograms.push({ id: "third", type: "major" });
  assert.equal((await app.model.execute({ ids: ["bait", "finance", "third"] })).status, "invalid");
  assert.match(app.feedback[1].errors[0].message, /three majors/i);
  assert.equal(checks, 0);
});

test("an allowed draft commits one complete requirement candidate with explicit major roles", async () => {
  const app = harness();

  const result = await app.model.execute({ ids: ["finance", "bait", "cs"], primaryId: "bait" });

  assert.equal(result.status, "committed");
  assert.deepEqual(plain(app.state.selectedPrograms), ["finance", "bait", "cs"]);
  assert.equal(app.state.primaryProgramId, "bait");
  assert.equal(app.state.secondaryProgramId, "finance");
  assert.equal(app.state.requiredProgramTab, "bait");
  assert.equal(app.state.programSelectionConfirmed, true);
  assert.equal(app.state.requirementsLoading, false);
  assert.equal(app.state.programApplyPending, false);
  assert.equal(app.saves(), 1);
  assert.deepEqual(app.pending, [true, false, true, false]);
  assert.deepEqual(app.loading, [true, false]);
  assert.equal(app.committed.length, 1);
});

test("policy warnings defer requirement loading until the user explicitly proceeds", async () => {
  let loads = 0;
  const app = harness({
    checkSelection: async () => ({ allowed: true, warnings: [{ message: "Confirm with advising." }] }),
    loadCandidate: async () => { loads += 1; return { selectedPrograms: ["bait"], majorRequirementTree: {} }; },
  });

  const result = await app.model.execute({ ids: ["bait", "math"], primaryId: "bait" });
  assert.equal(result.status, "warnings");
  assert.equal(loads, 0);
  assert.equal(app.warnings.length, 1);

  const accepted = await app.warnings[0].proceed();
  assert.equal(accepted.status, "committed");
  assert.equal(loads, 1);
  assert.deepEqual(plain(app.state.selectedPrograms), ["bait", "math"]);
});

test("a failed requirement candidate leaves the accepted program state unchanged", async () => {
  const app = harness({ loadCandidate: async () => { throw new Error("offline"); } });

  const result = await app.model.execute({ ids: ["finance"], primaryId: "finance" });

  assert.equal(result.status, "rolled_back");
  assert.deepEqual(app.state.selectedPrograms, ["bait"]);
  assert.equal(app.state.primaryProgramId, "bait");
  assert.equal(app.saves(), 0);
  assert.match(app.feedback.at(-1).errors[0].message, /offline/);
});

test("an older warning confirmation cannot replace a newer accepted selection", async () => {
  let checks = 0;
  let loads = 0;
  const app = harness({
    checkSelection: async () => {
      checks += 1;
      return checks === 1
        ? { allowed: true, warnings: [{ message: "Review first." }] }
        : { allowed: true, warnings: [] };
    },
    loadCandidate: async (ids) => {
      loads += 1;
      return { selectedPrograms: ids, majorRequirementTree: { id: ids.join("+") } };
    },
  });

  assert.equal((await app.model.execute({ ids: ["bait", "cs"], primaryId: "bait" })).status, "warnings");
  const oldProceed = app.warnings[0].proceed;
  assert.equal((await app.model.execute({ ids: ["finance"], primaryId: "finance" })).status, "committed");
  assert.equal((await oldProceed()).status, "stale");
  assert.deepEqual(plain(app.state.selectedPrograms), ["finance"]);
  assert.equal(loads, 1);
});
