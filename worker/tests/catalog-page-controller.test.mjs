import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/catalog-page-controller.js", import.meta.url);
const context = { globalThis: {}, URLSearchParams, encodeURIComponent };
const filterModuleUrl = new URL("../../apps/web/src/catalog-filter-model.js", import.meta.url);
if (fs.existsSync(filterModuleUrl)) {
  vm.runInNewContext(fs.readFileSync(filterModuleUrl, "utf8"), context);
}
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function controllers() {
  assert.ok(
    context.globalThis.ScheduleRUCatalogPageController,
    "catalog-page-controller.js must expose ScheduleRUCatalogPageController",
  );
  return context.globalThis.ScheduleRUCatalogPageController;
}

class FakeClassList {
  toggle() {}
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.innerHTML = "";
    this.value = "";
    this.dataset = {};
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.scrollLeft = 0;
    this.scrollTop = 0;
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  querySelectorAll() { return []; }
  setAttribute() {}
  focus() { this.focused = true; }
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture({ request } = {}) {
  const elements = {
    coursesRoot: new FakeElement("coursesRoot"),
    "page-courses": new FakeElement("page-courses"),
  };
  const document = {
    activeElement: null,
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
  };
  const state = {
    backendUrl: "https://catalog.example",
    backendSearch: "",
    backendSubject: "",
    backendLevels: [],
    backendCredits: [],
    backendAvailability: "any",
    backendCoreCodes: [],
    backendPage: 1,
    backendCourses: [],
    backendTotal: 0,
    backendLoading: false,
    backendError: "",
    backendSubjects: [],
    backendStatus: null,
    backendRequirementFilter: null,
    backendSelectorGroupId: null,
    expandedIds: new Set(),
    sectionsCache: {},
    wishlist: {},
  };
  const calls = { requests: [], eligibility: [], saves: 0, additions: [], requirementChoices: [] };
  const controller = controllers().create({
    getState: () => state,
    document,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => callback(),
    clearTimeout: () => {},
    pageSize: 25,
    request: async (path) => {
      calls.requests.push(path);
      return request ? request(path) : { courses: [], total: 0 };
    },
    saveBackendUrl: (url) => { state.backendUrl = url; },
    selectorContext: () => state.backendRequirementFilter,
    loadEligibilityForCodes: async (codes) => { calls.eligibility.push(codes); },
    catalogCourseCode: (course) => course.code,
    backendCourseRecord: (course) => course,
    wishlistRecords: () => Object.entries(state.wishlist)
      .map(([key, value]) => ({ ...value, key })),
    addToWishlist: (code) => {
      calls.additions.push(code);
      state.wishlist[code] = { code };
    },
    activeRequirementChoice: () => state.activeRequirementChoice || null,
    useForRequirement: (course) => {
      calls.requirementChoices.push(course.code);
      return { status: "committed" };
    },
    saveState: () => { calls.saves += 1; },
    plannerUI: { catalogWishlistAction: ({ inWishlist }) => ({
      label: inWishlist ? "Remove" : "+ Wishlist",
      remove: inWishlist,
    }) },
    selectorLogic: {
      selectorDescription: () => "approved courses",
      matchesAnySelector: () => true,
    },
    filterModel: context.globalThis.ScheduleRUCatalogFilterModel,
    userMessageModel: {
      presentIssue: () => ({ title: "Course data unavailable", message: "Please try again." }),
    },
    interactionLogic: { catalogViewState: () => ({
      restoreSearchFocus: false,
      selectionStart: null,
      selectionEnd: null,
      scrollLeft: 0,
      scrollTop: 0,
    }) },
    escapeHtml: (value) => String(value),
    cleanText: (value) => String(value || ""),
    courseCreditsLabel: (value) => `${value} credits`,
    formatMeeting: () => "Monday 10:00 AM",
    groupDisplayName: (group) => group?.name || "Requirement",
  });
  return { controller, state, calls, elements };
}

test("catalog loading sends filters, records eligibility, and renders pagination", async () => {
  const app = fixture({ request: async () => ({
    courses: [{ id: "c1", code: "01:198:111", title: "Intro Computer Science", credits: 4 }],
    total: 26,
  }) });
  app.state.backendSearch = "computer";
  app.state.backendSubject = "198";

  await app.controller.loadCourses();

  assert.match(app.calls.requests[0], /search=computer/);
  assert.match(app.calls.requests[0], /subject=198/);
  assert.deepEqual(app.calls.eligibility, [["01:198:111"]]);
  assert.equal(app.state.backendLoading, false);
  assert.equal(app.state.backendTotal, 26);
  assert.match(app.elements.coursesRoot.innerHTML, /Intro Computer Science/);
  assert.match(app.elements.coursesRoot.innerHTML, /Page 1 of 2/);
});

test("a slower old search cannot replace a newer catalog response", async () => {
  const oldRequest = deferred();
  const app = fixture({ request: (path) => path.includes("search=old")
    ? oldRequest.promise
    : Promise.resolve({ courses: [{ id: "new", code: "01:198:112", title: "New result", credits: 4 }], total: 1 }) });
  app.state.backendSearch = "old";
  const oldLoad = app.controller.loadCourses();
  app.state.backendSearch = "new";
  await app.controller.loadCourses();
  oldRequest.resolve({ courses: [{ id: "old", code: "01:198:111", title: "Old result", credits: 4 }], total: 1 });
  await oldLoad;

  assert.equal(app.state.backendCourses[0].title, "New result");
  assert.match(app.elements.coursesRoot.innerHTML, /New result/);
  assert.doesNotMatch(app.elements.coursesRoot.innerHTML, /Old result/);
});

test("expanding a course lazily loads its sections only once", async () => {
  const app = fixture({ request: async (path) => path.includes("/sections")
    ? { sections: [{ section_number: "01", open_status: true, meetings: [] }] }
    : { courses: [], total: 0 } });

  await app.controller.toggleCourseExpand("course-id");
  await app.controller.toggleCourseExpand("course-id");
  await app.controller.toggleCourseExpand("course-id");

  assert.equal(app.calls.requests.filter((path) => path.includes("/sections")).length, 1);
  assert.equal(app.state.expandedIds.has("course-id"), true);
  assert.equal(app.state.sectionsCache["course-id"].sections.length, 1);
});

test("wishlist actions add and remove the canonical course code", () => {
  const app = fixture();

  app.controller.toggleWishlist("01:198:111");
  assert.deepEqual(app.calls.additions, ["01:198:111"]);

  app.controller.toggleWishlist("01:198:111");
  assert.deepEqual(app.state.wishlist, {});
  assert.equal(app.calls.saves, 1);
});

test("an active requirement choice replaces Wishlist with one themed course action", async () => {
  const app = fixture({ request: async () => ({
    courses: [{ id: "c1", code: "01:355:201", title: "Research in the Disciplines", credits: 3 }],
    total: 1,
  }) });
  app.state.activeRequirementChoice = {
    requirementGroupId: "core-wcr",
    label: "Revision-Based Writing [WCr]",
  };
  app.state.backendRequirementFilter = {
    group: { id: "core-wcr", name: "Revision-Based Writing [WCr]" },
    selectors: [{ version: 1, kind: "course_codes", include_course_codes: ["01:355:201"] }],
  };
  app.state.backendSearch = "writing";
  app.state.backendSubject = "355";
  app.state.backendLevels = [300];
  app.state.backendCredits = [3];
  app.state.backendAvailability = "open";

  await app.controller.loadCourses();

  assert.match(app.elements.coursesRoot.innerHTML, /class="cr-wish cr-use"[^>]*>Use this course</);
  assert.doesNotMatch(app.elements.coursesRoot.innerHTML, /\+ Wishlist/);
  assert.match(app.elements.coursesRoot.innerHTML, /id="cpSubject"/);
  assert.match(app.elements.coursesRoot.innerHTML, /id="cpLevel"/);
  assert.match(app.elements.coursesRoot.innerHTML, /WCr/);
  assert.match(app.elements.coursesRoot.innerHTML, /data-filter-clear="requirement"/);
  const requestUrl = new URL(app.calls.requests[0], "https://catalog.example");
  assert.equal(requestUrl.searchParams.get("search"), "writing");
  assert.equal(requestUrl.searchParams.get("subject"), "355");
  assert.equal(requestUrl.searchParams.get("levels"), "300");
  assert.equal(requestUrl.searchParams.get("credits"), "3");
  assert.equal(requestUrl.searchParams.get("availability"), "open");
  assert.equal(requestUrl.searchParams.get("core"), "WCr");
  assert.deepEqual(app.controller.useForRequirement("01:355:201"), { status: "committed" });
  assert.deepEqual(app.calls.requirementChoices, ["01:355:201"]);
});

test("course rows render stable Core attribute badges", async () => {
  const app = fixture({ request: async () => ({
    courses: [{
      id: "c1", code: "01:355:201", title: "Research in the Disciplines", credits: 3,
      attributes: ["WCr", "AH"],
    }],
    total: 1,
  }) });

  await app.controller.loadCourses();

  assert.match(app.elements.coursesRoot.innerHTML, /class="core-badge"[^>]*data-core-filter="WCr"[^>]*>WCr</);
  assert.match(app.elements.coursesRoot.innerHTML, /class="core-badge"[^>]*data-core-filter="AH"[^>]*>AH</);
});

test("clicking a Core badge adds an API-backed Core filter chip", async () => {
  const app = fixture({ request: async () => ({ courses: [], total: 0 }) });

  await app.controller.filterByCore("WCr");

  assert.deepEqual([...app.state.backendCoreCodes], ["WCr"]);
  assert.match(app.calls.requests[0], /core=WCr/);
  assert.match(app.elements.coursesRoot.innerHTML, /Core: WCr/);
});
