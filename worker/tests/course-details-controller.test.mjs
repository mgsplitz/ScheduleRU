import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/course-details-controller.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function controllers() {
  assert.ok(
    context.globalThis.ScheduleRUCourseDetailsController,
    "course-details-controller.js must expose ScheduleRUCourseDetailsController",
  );
  return context.globalThis.ScheduleRUCourseDetailsController;
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
    this.listeners = new Map();
    this.attributes = new Map();
    this.innerHTML = "";
    this.textContent = "";
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
  querySelector(selector) { return selector === "[role=dialog]" ? this.dialog || null : null; }
  focus() { this.focused = true; }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture({
  courseOverrides = {},
  stateOverrides = {},
  prerequisiteEligibility,
  loadEligibilityForCodes,
  courseEligibilityNotice = () => "",
  resumeResult = true,
} = {}) {
  const ids = [
    "prOv", "prTitle", "prBody", "prClose", "app", "page-courses",
    "onboarding", "programOv", "appModal",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const dialog = new FakeElement("courseDetailsDialog");
  elements.prOv.dialog = dialog;
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
  const course = {
    id: "c1",
    code: "01:198:111",
    title: "Intro Computer Sci",
    fullTitle: "Introduction to Computer Science",
    credits: 4,
    restrictions: "",
    requirementNotes: [],
    alternatives: [],
    catalogRecordAvailable: true,
    ...courseOverrides,
  };
  const state = {
    year: 1,
    schedule: {},
    completed: {},
    courseEligibilityFetched: { "01:198:111": true },
    onboarding: { completed: true },
    ...stateOverrides,
  };
  const calls = { resume: 0, loads: [] };
  const controller = controllers().create({
    getState: () => state,
    document,
    requestAnimationFrame: (callback) => callback(),
    getCourse: (id) => id === course.id ? course : null,
    getCourseByCode: () => null,
    loadEligibilityForCodes: async (codes) => {
      calls.loads.push(codes);
      return loadEligibilityForCodes ? loadEligibilityForCodes(codes, course, state) : false;
    },
    requirementCourseId: (code) => code,
    prerequisiteEligibilityForTerm: prerequisiteEligibility || (() => ({
      status: "eligible_now",
      plan: { paths: [], references: [], verifiedNoPrerequisites: true },
      paths: [],
    })),
    prerequisiteBlockerLabel: () => "Complete a prerequisite first",
    standingRequirement: () => null,
    courseEligibilityNotice,
    academicYearLabel: (year) => `${year}st Year`,
    plannerUI: { coursePathState: () => ({ message: "No prerequisites listed." }) },
    escapeHtml: (value) => String(value),
    cleanText: (value) => String(value || ""),
    courseCreditsLabel: (credits) => `${credits} credits`,
    resumeRequirementPicker: () => { calls.resume += 1; return resumeResult; },
  });
  return { controller, document, elements, launcher, pagenav, state, calls };
}

test("opening course details presents the course and moves focus into the dialog", () => {
  const app = fixture();

  assert.equal(app.controller.open("c1"), true);

  assert.equal(app.elements.prOv.classList.contains("open"), true);
  assert.equal(app.elements.prOv.getAttribute("aria-hidden"), "false");
  assert.equal(app.elements.prTitle.textContent, "Course details");
  assert.match(app.elements.prBody.innerHTML, /Introduction to Computer Science/);
  assert.match(app.elements.prBody.innerHTML, /01:198:111 · 4 credits/);
  assert.match(app.elements.prBody.innerHTML, /No prerequisites listed\./);
  assert.equal(app.elements.prClose.focused, true);
  assert.equal(app.elements.app.inert, true);
  assert.equal(app.elements["page-courses"].inert, true);
  assert.equal(app.pagenav.inert, true);
});

test("Escape closes course details once and resumes the suspended requirement picker", () => {
  const app = fixture();
  app.state.returnToPicker = true;
  app.state.pickerGroupId = "g1";
  app.controller.bind();
  app.controller.bind();
  app.controller.open("c1");

  app.document.dispatch("keydown", { key: "Escape" });

  assert.equal(app.elements.prOv.classList.contains("open"), false);
  assert.equal(app.elements.prOv.getAttribute("aria-hidden"), "true");
  assert.equal(app.state.returnToPicker, false);
  assert.equal(app.calls.resume, 1);
  assert.equal(app.launcher.focused, undefined);
});

test("closing restores its launcher when a suspended picker can no longer resume", () => {
  const app = fixture({ resumeResult: false });
  app.state.returnToPicker = true;
  app.state.pickerGroupId = "missing-group";
  app.controller.open("c1");

  app.controller.close();

  assert.equal(app.calls.resume, 1);
  assert.equal(app.launcher.focused, true);
});

test("course details preserve reviewed alternatives, eligibility notices, and prerequisite paths", () => {
  const app = fixture({
    courseOverrides: {
      alternatives: [{ code: "01:198:112", title: "Data Structures" }],
      description: "A survey of programming fundamentals.",
      catalogPrereqs: "01:198:112",
    },
    stateOverrides: {
      completed: { "01:198:112": true },
    },
    courseEligibilityNotice: () => "Junior standing must be confirmed.",
    prerequisiteEligibility: () => ({
      status: "blocked",
      plan: {
        paths: [["01:198:112"]],
        references: [{ course_code: "01:198:112", title: "Data Structures" }],
        source: "catalog",
      },
      paths: [{
        missing: [{ course_code: "01:198:112", reason: "same_term" }],
        courseStates: [{ course_code: "01:198:112", state: "same_term" }],
      }],
      recommendedPath: {
        missing: [{ course_code: "01:198:112", reason: "same_term" }],
      },
    }),
  });

  app.controller.open("c1");

  assert.match(app.elements.prBody.innerHTML, /already fulfilled by Data Structures/);
  assert.match(app.elements.prBody.innerHTML, /Junior standing must be confirmed\./);
  assert.match(app.elements.prBody.innerHTML, /Complete before this course/);
  assert.match(app.elements.prBody.innerHTML, /Same semester — not eligible/);
  assert.match(app.elements.prBody.innerHTML, /Official prerequisite wording/);
  assert.match(app.elements.prBody.innerHTML, /A survey of programming fundamentals\./);
});

test("newly loaded eligibility details refresh the course that is still open", async () => {
  const request = deferred();
  const app = fixture({
    stateOverrides: { courseEligibilityFetched: {} },
    loadEligibilityForCodes: async (_codes, course, state) => {
      await request.promise;
      state.courseEligibilityFetched[course.code] = true;
      course.description = "Updated catalog details.";
      return true;
    },
  });

  app.controller.open("c1");
  assert.equal(app.calls.loads.length, 1);
  assert.doesNotMatch(app.elements.prBody.innerHTML, /Updated catalog details\./);

  request.resolve();
  await request.promise;
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(app.elements.prBody.innerHTML, /Updated catalog details\./);
  assert.equal(app.calls.loads.length, 1);
});

test("a failed eligibility refresh leaves the initial course details usable", async () => {
  const app = fixture({
    stateOverrides: { courseEligibilityFetched: {} },
    loadEligibilityForCodes: async () => { throw new Error("catalog offline"); },
  });

  app.controller.open("c1");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(app.elements.prOv.classList.contains("open"), true);
  assert.match(app.elements.prBody.innerHTML, /Introduction to Computer Science/);
});
