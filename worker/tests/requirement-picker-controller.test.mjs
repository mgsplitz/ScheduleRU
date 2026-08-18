import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../apps/web/src/planner-ui-logic.js");

const moduleUrl = new URL("../../apps/web/src/requirement-picker-controller.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function controllers() {
  assert.ok(
    context.globalThis.ScheduleRURequirementPickerController,
    "requirement-picker-controller.js must expose ScheduleRURequirementPickerController",
  );
  return context.globalThis.ScheduleRURequirementPickerController;
}

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
    this.selectorResults = new Map();
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
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
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  querySelector(selector) {
    if (selector === "[role=dialog]") return this.dialog || null;
    return (this.selectorResults.get(selector) || [])[0] || null;
  }
  querySelectorAll(selector) { return this.selectorResults.get(selector) || []; }
  insertAdjacentHTML(_position, html) { this.innerHTML += html; }
  focus() { this.focused = true; }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fixture({ selectors = [], loadSelectorCourses } = {}) {
  const ids = [
    "pickerOv", "pickerClose", "pickerTitle", "pickerSearch", "pickerIntro",
    "pickerList", "app", "page-courses", "onboarding", "programOv", "appModal",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const dialog = new FakeElement("pickerDialog");
  elements.pickerOv.dialog = dialog;
  const pagenav = new FakeElement("pagenav");
  const launcher = new FakeElement("launcher");
  const documentListeners = new Map();
  const document = {
    activeElement: launcher,
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
      for (const handler of [...(documentListeners.get(type) || [])]) handler(event);
    },
  };
  const group = { id: "g1", name: "Approved electives", rule: "min", count: 1, members: ["c1"], children: [] };
  const courses = {
    c1: { id: "c1", code: "01:198:111", title: "Introduction to Computer Science", fullTitle: "Introduction to Computer Science", credits: 4 },
  };
  const state = {
    pickerGroupId: null,
    pickerSelector: null,
    groupSelections: {},
    wishlist: {},
    onboarding: { completed: true },
  };
  const timers = [];
  const calls = {
    loads: [], selections: [], wishlist: [], details: [], renderAll: 0, violations: [], registered: [],
  };
  const actionButton = new FakeElement("action");
  actionButton.dataset.paction = "c1";
  actionButton.dataset.pintent = "requirement";
  const detailsButton = new FakeElement("details");
  detailsButton.dataset.pview = "c1";
  elements.pickerList.selectorResults.set("[data-paction]", [actionButton]);
  elements.pickerList.selectorResults.set("[data-pview]", [detailsButton]);

  const controller = controllers().create({
    getState: () => state,
    document,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    pageSize: 50,
    getGroup: (id) => id === group.id ? group : null,
    getCourse: (id) => courses[id] || null,
    selectorsForGroup: () => selectors,
    groupDisplayName: (value) => value.name,
    groupRuleLabel: (value) => value.rule,
    isConstraintGroup: () => false,
    selectedCourseIds: (groupId) => state.groupSelections[groupId] || [],
    appliedCourseIds: () => [],
    selectionLimit: (value) => value.count,
    registerSelectorCourseRecord: (record) => { calls.registered.push(record); return record.id; },
    loadSelectorCourses: async (request) => {
      calls.loads.push(request);
      return loadSelectorCourses ? loadSelectorCourses(request) : { courses: [], total: 0 };
    },
    courseRecordFromId: (id) => courses[id] || null,
    plannerUI: globalThis.ScheduleRUPlannerUI,
    escapeHtml: (value) => String(value),
    courseCreditsLabel: (value) => `${value} cr`,
    constraintViolation: () => "",
    showSelectionReview: (message) => calls.violations.push(message),
    commitSelection: (groupId, selectedIds, record) => {
      state.groupSelections[groupId] = [...selectedIds];
      calls.selections.push({ groupId, selectedIds: [...selectedIds], record });
    },
    toggleWishlist: (record) => calls.wishlist.push(record),
    renderAll: () => { calls.renderAll += 1; },
    openCourseDetails: (id) => calls.details.push(id),
    userMessageModel: {
      presentIssue: () => ({ message: "Approved courses are temporarily unavailable." }),
    },
  });
  return { controller, document, elements, launcher, pagenav, group, state, timers, calls, actionButton, detailsButton };
}

test("binding twice still gives the requirement picker one close and keyboard lifecycle", () => {
  const app = fixture();
  app.controller.bind();
  app.controller.bind();

  app.controller.open("g1");
  assert.equal(app.elements.pickerOv.classList.contains("open"), true);
  assert.equal(app.elements.pickerOv.getAttribute("aria-hidden"), "false");
  assert.equal(app.elements.pickerTitle.textContent, "Approved electives");
  assert.equal(app.elements.pickerSearch.focused, true);
  assert.equal(app.elements.app.inert, true);

  app.document.dispatch("keydown", { key: "Escape" });
  assert.equal(app.elements.pickerOv.classList.contains("open"), false);
  assert.equal(app.elements.pickerOv.getAttribute("aria-hidden"), "true");
  assert.equal(app.state.pickerGroupId, null);
  assert.equal(app.elements.app.inert, false);
  assert.equal(app.launcher.focused, true);
});

test("closing a selector-backed picker prevents its pending response from registering courses", async () => {
  const request = deferred();
  const app = fixture({ selectors: [{ type: "subject", subject: "198" }], loadSelectorCourses: () => request.promise });

  app.controller.open("g1");
  assert.equal(app.calls.loads.length, 1);
  app.controller.close();
  request.resolve({ courses: [{ id: "remote" }], total: 1 });
  await request.promise;
  await Promise.resolve();

  assert.equal(app.state.pickerSelector, null);
  assert.deepEqual(app.calls.registered, []);
});

test("selector search waits for the debounce and resets pagination", async () => {
  const app = fixture({ selectors: [{ type: "subject", subject: "198" }] });
  app.controller.bind();
  app.controller.open("g1");
  await Promise.resolve();
  app.state.pickerSelector.page = 3;

  app.elements.pickerSearch.value = "data";
  app.elements.pickerSearch.dispatch("input");
  assert.equal(app.calls.loads.length, 1);
  assert.equal(app.state.pickerSelector.page, 1);
  app.timers.at(-1)();
  await Promise.resolve();

  assert.equal(app.calls.loads.length, 2);
  assert.equal(app.calls.loads[1].search, "data");
  assert.equal(app.calls.loads[1].offset, 0);
});

test("typing a new selector search invalidates the request already in flight", async () => {
  const firstRequest = deferred();
  const app = fixture({
    selectors: [{ type: "subject", subject: "198" }],
    loadSelectorCourses: () => firstRequest.promise,
  });
  app.controller.bind();
  app.controller.open("g1");

  app.elements.pickerSearch.value = "data";
  app.elements.pickerSearch.dispatch("input");
  firstRequest.resolve({ courses: [{ id: "stale-course" }], total: 1 });
  await firstRequest.promise;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(app.calls.registered.length, 0);
  assert.equal(app.state.pickerSelector.records.length, 0);
});

test("a requirement action commits only the active group selection", () => {
  const app = fixture();
  app.controller.open("g1");

  app.actionButton.dispatch("click");

  assert.deepEqual(app.calls.selections, [{
    groupId: "g1",
    selectedIds: ["c1"],
    record: {
      id: "c1",
      code: "01:198:111",
      title: "Introduction to Computer Science",
      fullTitle: "Introduction to Computer Science",
      credits: 4,
    },
  }]);
  assert.equal(app.calls.renderAll, 1);
});

test("viewing course details suspends the picker without discarding its group", () => {
  const app = fixture();
  app.controller.open("g1");

  app.detailsButton.dispatch("click");

  assert.equal(app.elements.pickerOv.classList.contains("open"), false);
  assert.equal(app.state.pickerGroupId, "g1");
  assert.deepEqual(app.calls.details, ["c1"]);
  app.controller.resume();
  assert.equal(app.elements.pickerOv.classList.contains("open"), true);
  assert.equal(app.state.pickerGroupId, "g1");
});
