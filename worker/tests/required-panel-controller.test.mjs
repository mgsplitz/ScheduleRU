import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/required-panel-controller.js", import.meta.url);
await import("../../packages/requirements/src/requirement-group-logic.js");
const context = { globalThis: { ScheduleRURequirementLogic: globalThis.ScheduleRURequirementLogic } };
const modelUrl = new URL("../../packages/requirements/src/program-requirement-model.js", import.meta.url);
if (fs.existsSync(modelUrl)) vm.runInNewContext(fs.readFileSync(modelUrl, "utf8"), context);
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
    homeSchoolSlug: "rbsnb",
    availableSchools: [{ slug: "rbsnb", name: "RBS New Brunswick", core_label: "Business Core" }],
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
    groupFulfilled: (id) => id === "done",
    expansionOpen: ({ stored, defaultOpen }) => stored ?? defaultOpen,
    openRequirementPicker: () => {},
    showIssues: () => {},
    renderPanel: () => {},
    userMessageModel: {
      presentIssue: () => ({ title: "We couldn't connect", message: "Please try again." }),
    },
    programRequirementModel: context.globalThis.ScheduleRUProgramRequirementModel || {
      requirementTabs: ({ programs }) => programs.map((program) => ({
        id: program.id,
        label: program.name,
        kind: "program",
        minor: program.type === "minor",
      })),
      nextActions: (progress) => progress.filter((item) => !item.complete).slice(0, 3),
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
  assert.match(ready, /We couldn't display these requirements/);
  assert.match(ready, /ScheduleRU is a planning aid/);
});

test("shared school requirements render once and Next up stays concise", () => {
  const groups = {
    shared: {
      id: "shared",
      label: "Business Core",
      rule: "all",
      display_family: "rbsnb-business-core",
      sourceProgramIds: ["primary", "secondary"],
      members: [],
      children: [],
    },
    finance: {
      id: "finance",
      label: "Finance electives",
      rule: "all",
      sourceProgramIds: ["primary"],
      members: [],
      children: [],
    },
    done: {
      id: "done",
      label: "Completed group",
      rule: "all",
      sourceProgramIds: ["primary"],
      members: [],
      children: [],
    },
  };
  const { app, state } = controller({ groups });

  const sharedMarkup = app.markup();
  assert.equal(state.requiredProgramTab, "school:rbsnb");
  assert.match(sharedMarkup, /Business Core/);
  assert.doesNotMatch(sharedMarkup, /Finance electives/);
  assert.match(sharedMarkup, /required-root-body open/);
  assert.match(sharedMarkup, /data-required-next-tab="primary"/);
  assert.match(sharedMarkup, /Required Finance courses/);

  app.setProgram("primary");
  const financeMarkup = app.markup();
  assert.doesNotMatch(financeMarkup, /data-required-root-toggle="shared"/);
  assert.match(financeMarkup, /Finance electives/);
  assert.match(financeMarkup, /Next up/);
  assert.doesNotMatch(financeMarkup, /Completed group<\/li>/);
  assert.match(financeMarkup, /required-root-body"/);
});
