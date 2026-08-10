import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../apps/web/src/planner-ui-logic.js");
await import("../../apps/web/src/program-picker-logic.js");

const moduleUrl = new URL("../../apps/web/src/program-picker-controller.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function controllers() {
  assert.ok(
    context.globalThis.ScheduleRUProgramPickerController,
    "program-picker-controller.js must expose ScheduleRUProgramPickerController",
  );
  return context.globalThis.ScheduleRUProgramPickerController;
}
const plain = (value) => JSON.parse(JSON.stringify(value));

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.classList = new FakeClassList();
    this.dataset = {};
    this.listeners = new Map();
    this.attributes = new Map();
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.inert = false;
    this.isConnected = true;
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  dispatch(type, properties = {}) {
    const event = { target: this, preventDefault() {}, ...properties };
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  querySelector(selector) {
    if (selector === "[role=dialog]") return this.dialog || null;
    if (selector.includes("input")) return this.focusTarget || null;
    return null;
  }
  querySelectorAll() { return []; }
  focus() { this.focused = true; }
}

function fixture() {
  const ids = [
    "programOv", "programBtn", "programClose", "programCancel", "programApply",
    "programPickerNote", "programSearch", "programList", "programSchoolNav",
    "programRoleControls", "app", "page-courses", "onboarding", "appModal",
    "onboardingPrograms",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const pagenav = new FakeElement("pagenav");
  const dialog = new FakeElement("dialog");
  const focusTarget = new FakeElement("focusTarget");
  dialog.focusTarget = focusTarget;
  elements.programOv.dialog = dialog;
  const documentListeners = new Map();
  const document = {
    activeElement: elements.programBtn,
    body: new FakeElement("body"),
    getElementById: (id) => elements[id] || null,
    querySelector: (selector) => selector === ".pagenav" ? pagenav : null,
    addEventListener(type, handler) {
      const handlers = documentListeners.get(type) || [];
      handlers.push(handler);
      documentListeners.set(type, handlers);
    },
    dispatch(type, properties = {}) {
      const event = { preventDefault() {}, ...properties };
      for (const handler of documentListeners.get(type) || []) handler(event);
    },
  };
  const state = {
    selectedPrograms: ["bait"],
    primaryProgramId: "bait",
    availableSchools: [{ slug: "rbsnb", name: "RBS New Brunswick" }],
    availablePrograms: [
      { id: "bait", name: "Business Analytics", type: "major", school_slug: "rbsnb", degree_type: "B.S." },
      { id: "finance", name: "Finance", type: "major", school_slug: "rbsnb", degree_type: "B.S." },
    ],
    onboarding: { completed: true },
    programApplyPending: false,
  };
  let feedbackCalls = 0;
  let applyCalls = 0;
  const controller = controllers().create({
    getState: () => state,
    document,
    requestAnimationFrame: (callback) => callback(),
    pickerLogic: globalThis.ScheduleRUProgramPickerLogic,
    plannerUI: globalThis.ScheduleRUPlannerUI,
    escapeHtml: (value) => String(value),
    cleanText: (value) => String(value || "").trim(),
    getProgramTypeSections: () => [{ type: "major", label: "Majors", singular: "Major" }],
    programTypeLabel: () => "Major",
    programCoverageLabel: () => "Reviewed requirements",
    selectionLimitSummary: () => "Up to two majors.",
    showFeedback: () => { feedbackCalls += 1; },
    onApply: () => { applyCalls += 1; },
  });
  return { controller, document, elements, pagenav, focusTarget, state, feedbackCalls: () => feedbackCalls, applyCalls: () => applyCalls };
}

test("binding twice still opens and applies the program picker exactly once", () => {
  const app = fixture();
  app.controller.bind();
  app.controller.bind();

  app.elements.programBtn.dispatch("click");
  assert.equal(app.feedbackCalls(), 1);
  assert.equal(app.elements.programOv.classList.contains("open"), true);
  assert.equal(app.elements.programOv.getAttribute("aria-hidden"), "false");
  assert.deepEqual(plain(app.state.programDraft), ["bait"]);
  assert.equal(app.state.programDraftPrimaryId, "bait");
  assert.equal(app.elements.app.inert, true);
  assert.equal(app.focusTarget.focused, true);

  app.elements.programApply.dispatch("click");
  assert.equal(app.applyCalls(), 1);
});

test("render keeps browsing, degree metadata, draft roles, and close behavior in one controller", () => {
  const app = fixture();
  app.state.programDraft = ["finance", "bait"];
  app.state.programDraftPrimaryId = "bait";
  app.state.programBrowseSchoolSlug = "rbsnb";
  app.state.programSearch = "";

  app.controller.render();
  assert.match(app.elements.programSchoolNav.innerHTML, /RBS New Brunswick/);
  assert.match(app.elements.programList.innerHTML, /Finance/);
  assert.match(app.elements.programList.innerHTML, /B\.S\./);
  assert.match(app.elements.programRoleControls.innerHTML, /Primary: Business Analytics/);
  assert.match(app.elements.programRoleControls.innerHTML, /Make primary: Finance/);

  app.controller.open();
  app.controller.close();
  assert.equal(app.elements.programOv.classList.contains("open"), false);
  assert.equal(app.elements.programOv.getAttribute("aria-hidden"), "true");
  assert.equal("programDraft" in app.state, false);
  assert.equal(app.elements.app.inert, false);
});
