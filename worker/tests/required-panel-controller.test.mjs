import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/required-panel-controller.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function controller(overrides = {}) {
  assert.ok(
    context.globalThis.ScheduleRURequiredPanelController,
    "required-panel-controller.js must expose ScheduleRURequiredPanelController",
  );
  const state = {
    requirementsLoading: false,
    requirementsError: "",
    requiredProgramTab: "",
    requiredRootOpen: {},
    nestedGroupOpen: {},
    groupSelections: {},
    requirementTrees: {},
    majorRequirementTree: {},
    ...overrides.state,
  };
  const programs = overrides.programs || [
    { id: "minor", name: "Computer Science", type: "minor" },
    { id: "primary", name: "Finance", type: "major" },
    { id: "secondary", name: "BAIT", type: "major" },
  ];
  state.primaryProgramId = "primary";
  state.secondaryProgramId = "secondary";
  const groups = overrides.groups || {};
  const app = context.globalThis.ScheduleRURequiredPanelController.create({
    getState: () => state,
    selectedProgramRows: () => programs,
    useRequirementTree: () => {},
    getRequirementState: () => ({ groups, rootGroupIds: Object.keys(groups) }),
    issueList: () => [],
    escapeHtml: (value) => String(value),
    groupHtml: (id) => `<div data-group="${id}"></div>`,
    groupDisplayName: (group) => group.label || group.id,
    groupAppliedCourseIds: () => [],
    selectorGuidanceHtml: () => "",
    cardHtml: (id) => `<div>${id}</div>`,
    attachCardEvents: () => {},
    shouldAutoCollapseSharedGroup: () => false,
    expansionOpen: ({ stored, defaultOpen }) => stored ?? defaultOpen,
    openRequirementPicker: () => {},
    showIssues: () => {},
    renderPanel: () => {},
    userMessageModel: {
      presentIssue: () => ({ title: "We couldn't connect", message: "Please try again." }),
    },
  });
  return { app, state };
}

test("program tabs keep primary and secondary majors first, then remaining programs", () => {
  const { app } = controller();

  assert.deepEqual(
    Array.from(app.orderedPrograms(), (program) => program.id),
    ["primary", "secondary", "minor"],
  );
});

test("shared requirement ownership follows explicit owners before tree fallbacks", () => {
  const { app, state } = controller();
  state.requirementTrees.primary = [{ program_id: "shared-core", children: [] }];

  assert.equal(app.groupBelongsToProgram({ sourceProgramIds: ["secondary"] }, "primary"), false);
  assert.equal(app.groupBelongsToProgram({ sourceProgramIds: ["primary"] }, "primary"), true);
  assert.equal(app.groupBelongsToProgram({ sourceProgramId: "shared-core" }, "primary"), true);
});

test("markup distinguishes loading, errors, minor tabs, and empty reviewed programs", () => {
  const loading = controller({ state: { requirementsLoading: true } }).app.markup();
  assert.match(loading, /Loading requirements from Rutgers/);

  const failed = controller({ state: { requirementsError: "HTTP 500" } }).app.markup();
  assert.match(failed, /We couldn't connect/);
  assert.doesNotMatch(failed, /HTTP 500/);

  const ready = controller().app.markup();
  assert.match(ready, /program-subtab-minor/);
  assert.match(ready, /No reviewed requirements are available for this program yet/);
  assert.match(ready, /ScheduleRU is a planning aid/);
});
