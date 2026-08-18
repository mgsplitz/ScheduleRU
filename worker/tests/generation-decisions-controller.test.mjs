import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const controllerUrl = new URL("../../apps/web/src/generation-decisions-controller.js", import.meta.url);
const viewUrl = new URL("../../apps/web/src/generation-decisions-view.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(controllerUrl)) vm.runInNewContext(fs.readFileSync(controllerUrl, "utf8"), context);
if (fs.existsSync(viewUrl)) vm.runInNewContext(fs.readFileSync(viewUrl, "utf8"), context);

function modules() {
  assert.ok(context.globalThis.ScheduleRUGenerationDecisionsController);
  assert.ok(context.globalThis.ScheduleRUGenerationDecisionsView);
  return {
    controller: context.globalThis.ScheduleRUGenerationDecisionsController,
    view: context.globalThis.ScheduleRUGenerationDecisionsView,
  };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

function decisions() {
  return [
    {
      requirementGroupId: "core-ah", sourceProgram: "rutgers-nb-core", sourceType: "core",
      label: "Arts and Humanities [AH]", planningMode: "guided_flexible", canDefer: true,
      candidates: [{ code: "01:082:105", title: "Introduction to Art History", prerequisitePaths: [] }],
    },
    {
      requirementGroupId: "cs-electives", sourceProgram: "sasnb-computer-science-minor", sourceType: "program",
      label: "Computer Science electives", planningMode: "sequence_critical", canDefer: false,
      candidates: [
        { code: "01:198:111", title: "Intro Computer Science", prerequisitePaths: [] },
        { code: "01:198:213", title: "Software Methodology", prerequisitePaths: [["01:198:112"]] },
      ],
    },
    {
      requirementGroupId: "business-electives", sourceProgram: "rbsnb-finance-major", sourceType: "program",
      label: "Finance electives", planningMode: "guided_flexible", canDefer: false,
      candidates: [{ code: "33:390:380", title: "Investment Analysis", prerequisitePaths: [["33:390:300"]] }],
    },
  ];
}

test("Business decisions come first and Core decisions come last", () => {
  const flow = modules().controller.create({
    decisions: decisions(),
    programs: [
      { id: "rbsnb-finance-major", school_slug: "rbsnb" },
      { id: "sasnb-computer-science-minor", school_slug: "sasnb" },
    ],
  });

  assert.deepEqual(plain(flow.decisions().map((item) => item.requirementGroupId)), [
    "business-electives",
    "cs-electives",
    "core-ah",
  ]);
});

test("a restrictive subset is guided before the broader total for one program", () => {
  const broad = {
    decisionId: "program:philosophy:total", requirementGroupId: "total",
    sourceProgram: "philosophy", sourceType: "program", label: "Six Philosophy courses",
    planningMode: "guided_flexible", candidates: ["101", "301", "302"].map((code) => ({ code, title: code })),
  };
  const subset = {
    ...broad, decisionId: "program:philosophy:upper", requirementGroupId: "upper",
    label: "Three upper-level Philosophy courses", slotCount: 3,
    candidates: ["301", "302"].map((code) => ({ code, title: code })),
  };
  const flow = modules().controller.create({ decisions: [broad, subset] });

  assert.deepEqual(plain(flow.decisions().map((item) => item.requirementGroupId)), ["upper", "total"]);
});

test("interest buckets are exclusive and persist through a restarted flow", () => {
  const first = modules().controller.create({ decisions: decisions(), programs: [] });
  first.setInterest("cs-electives", "01:198:111", "interested");
  first.setInterest("cs-electives", "01:198:111", "avoid");
  const saved = first.preferences();

  assert.deepEqual(plain(saved["cs-electives"]), {
    interested: [], maybe: [], avoid: ["01:198:111"], mode: "ranked",
  });

  const restarted = modules().controller.create({
    decisions: decisions(), initialPreferences: saved, programs: [],
  });
  assert.deepEqual(plain(restarted.preferences()), plain(saved));
});

test("one global rating is reused across overlapping requirements", () => {
  const shared = { code: "01:730:424", title: "Logic of Decision", prerequisitePaths: [] };
  const flow = modules().controller.create({ decisions: [
    { ...decisions()[1], decisionId: "program:phil:upper", candidates: [shared] },
    { ...decisions()[1], decisionId: "program:phil:total", candidates: [shared, { code: "01:730:103", title: "Introduction", prerequisitePaths: [] }] },
  ] });

  flow.setInterest("program:phil:upper", shared.code, "interested");
  const saved = flow.preferences();
  assert.deepEqual(plain(saved.__global.interested), [shared.code]);
  assert.deepEqual(plain(flow.unratedCandidates("program:phil:total").map((course) => course.code)), ["01:730:103"]);
});

test("program decisions cannot defer while eligible Core decisions can", () => {
  const flow = modules().controller.create({ decisions: decisions(), programs: [] });

  assert.equal(flow.defer("business-electives"), false);
  assert.equal(flow.defer("core-ah"), true);
  assert.equal(flow.preferences()["core-ah"].mode, "deferred");
});

test("a program decision requires ranking or Choose for me before advancing", () => {
  const flow = modules().controller.create({ decisions: decisions(), programs: [] });

  assert.equal(flow.canAdvance("cs-electives"), false);
  flow.chooseForMe("cs-electives");
  assert.equal(flow.canAdvance("cs-electives"), true);
  assert.equal(flow.preferences()["cs-electives"].mode, "recommend_for_me");
});

test("the focused decision view shows prerequisite burden and only deferrable Core gets Later", () => {
  const { view } = modules();
  const programHtml = view.renderDecision({
    decision: decisions()[1], preference: {}, index: 0, total: 3,
  });
  const coreHtml = view.renderDecision({
    decision: decisions()[0], preference: {}, index: 2, total: 3,
  });

  assert.match(programHtml, /Builds on 1 course/);
  assert.match(programHtml, /Interested/);
  assert.match(programHtml, /Avoid is a preference/);
  assert.doesNotMatch(programHtml, /I’ll do this later/);
  assert.doesNotMatch(coreHtml, /I’ll do this later/);
});

test("decision-list scroll can be restored after an interest update rerenders the modal", () => {
  const { view } = modules();
  const before = { scrollTop: 418 };
  const after = { scrollTop: 0 };
  const document = { querySelector: () => after };

  assert.equal(view.captureListScroll({ querySelector: () => before }), 418);
  view.restoreListScroll(document, 418);
  assert.equal(after.scrollTop, 418);
});

test("same-named major and minor groups keep independent preference ownership", () => {
  const shared = {
    requirementGroupId: "electives", sourceType: "program",
    label: "Electives", planningMode: "guided_flexible", canDefer: false,
    candidates: [{ code: "01:730:103", title: "Introduction to Philosophy", prerequisitePaths: [] }],
  };
  const flow = modules().controller.create({
    decisions: [
      { ...shared, decisionId: "program:finance:electives", sourceProgram: "finance" },
      { ...shared, decisionId: "program:philosophy-minor:electives", sourceProgram: "philosophy-minor" },
    ],
  });

  flow.chooseForMe("program:finance:electives");
  assert.equal(flow.preferences()["program:finance:electives"].mode, "recommend_for_me");
  assert.equal(flow.preferences()["program:philosophy-minor:electives"].mode, "ranked");
});

test("multi-course guidance asks for as many preferences as possible", () => {
  const html = modules().view.renderDecision({
    decision: { ...decisions()[1], slotCount: 6 }, preference: {}, index: 0, total: 1,
  });
  assert.match(html, /Mark as many as you can/);
});

test("large guidance pools open with eight best matches and an expandable search", () => {
  const candidates = Array.from({ length: 20 }, (_, index) => ({
    code: `01:198:${String(300 + index)}`,
    title: `Course ${String(index + 1).padStart(2, "0")}`,
    prerequisitePaths: index < 8 ? [] : [["01:198:112"]],
  }));
  const collapsed = modules().view.renderDecision({
    decision: { ...decisions()[1], candidates }, preference: {}, index: 0, total: 1,
  });
  const expanded = modules().view.renderDecision({
    decision: { ...decisions()[1], candidates }, preference: {}, index: 0, total: 1,
    expanded: true, search: "Course 19",
  });

  assert.equal((collapsed.match(/class="generation-candidate"/g) || []).length, 8);
  assert.match(collapsed, /Best matches/);
  assert.match(collapsed, /Show all 20/);
  assert.match(expanded, /Course 19/);
  assert.doesNotMatch(expanded, /Course 18/);
});

test("best matches put gateway courses that unlock the pool first", () => {
  const candidates = [
    { code: "01:198:112", title: "Data Structures", prerequisitePaths: [] },
    ...Array.from({ length: 9 }, (_, index) => ({
      code: `01:198:${String(300 + index)}`,
      title: `Advanced ${index + 1}`,
      prerequisitePaths: [["01:198:112"]],
    })),
  ];
  const html = modules().view.renderDecision({
    decision: { ...decisions()[1], candidates }, preference: {}, index: 0, total: 1,
  });

  assert.ok(html.indexOf("Data Structures") < html.indexOf("Advanced 1"));
});

test("recommendation review is concise and exposes replacement before approval", () => {
  const html = modules().view.renderRecommendations({
    result: {
      selectedCourses: [{
        code: "01:198:111", title: "Introduction to Computer Science",
        coverageRequirementIds: ["cs", "rbs"], prerequisiteOnly: false,
      }],
      explanations: [{
        type: "multi_requirement_coverage", courseCode: "01:198:111",
        requirementIds: ["cs", "rbs"],
      }],
    },
    requirements: [
      { id: "cs", label: "Computer Science electives" },
      { id: "rbs", label: "Business computing" },
    ],
  });
  assert.match(html, /Covers Computer Science electives and Business computing/);
  assert.match(html, /data-replace-requirement="cs"/);
  assert.doesNotMatch(html, /multi_requirement_coverage/);
});
