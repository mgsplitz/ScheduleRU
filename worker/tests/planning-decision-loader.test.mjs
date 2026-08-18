import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/planning-decision-loader.js", import.meta.url);
const context = { globalThis: {}, URLSearchParams };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
const plain = (value) => JSON.parse(JSON.stringify(value));

function loader() {
  assert.ok(context.globalThis.ScheduleRUPlanningDecisionLoader);
  return context.globalThis.ScheduleRUPlanningDecisionLoader;
}

test("selector-backed minor decisions load every approved candidate and retain program ownership", async () => {
  const requests = [];
  const decision = {
    decisionId: "program:sasnb-philosophy-minor:total",
    requirementGroupId: "total",
    sourceProgram: "sasnb-philosophy-minor",
    sourceType: "program",
    planningMode: "guided_flexible",
    candidates: [],
    courseSelectors: [{ selector_json: JSON.stringify({ version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["730"], course_number_min: 100, course_number_max: 499 }) }],
  };

  const hydrated = await loader().hydrate({
    decisions: [decision],
    request: async (path) => {
      requests.push(path);
      return { total: 2, courses: [
        { code: "01:730:103", title: "Introduction to Philosophy" },
        { code: "01:730:104", title: "Introduction to Philosophy - Writing Intensive" },
      ] };
    },
    normalizeCandidate: (course) => ({ ...course, prerequisitePaths: [] }),
  });

  assert.equal(requests.length, 1);
  assert.match(requests[0], /limit=100/);
  assert.equal(hydrated[0].sourceProgram, "sasnb-philosophy-minor");
  assert.deepEqual(plain(hydrated[0].candidates.map((course) => course.code)), ["01:730:103", "01:730:104"]);
});

test("identical reviewed selector pools are fetched once and reused", async () => {
  let requests = 0;
  const selectors = [{ selector_json: JSON.stringify({ version: 1, kind: "course_codes", include_course_codes: ["01:198:111"] }) }];
  const hydrated = await loader().hydrate({
    decisions: [
      { decisionId: "a", candidates: [], courseSelectors: selectors },
      { decisionId: "b", candidates: [], courseSelectors: selectors },
    ],
    request: async () => { requests += 1; return { total: 1, courses: [{ code: "01:198:111" }] }; },
    normalizeCandidate: (course) => ({ ...course, prerequisitePaths: [] }),
  });

  assert.equal(requests, 1);
  assert.equal(hydrated[0].candidates.length, 1);
  assert.equal(hydrated[1].candidates.length, 1);
});

test("explicit Mathematics choices merge with every reviewed selector candidate", async () => {
  const explicit = [
    { code: "01:640:244", title: "Differential Equations for Engineering and Physics" },
    { code: "01:640:252", title: "Elementary Differential Equations" },
  ];
  const selectorCourses = Array.from({ length: 28 }, (_, index) => ({
    code: `01:640:${String(300 + index).padStart(3, "0")}`,
    title: `Mathematics elective ${index + 1}`,
  }));
  const hydrated = await loader().hydrate({
    decisions: [{
      decisionId: "program:sasnb-mathematics-minor:electives",
      candidates: explicit,
      courseSelectors: [{
        selector_json: JSON.stringify({
          version: 1,
          kind: "subject_level",
          school_codes: ["01"],
          subject_codes: ["640"],
          course_number_min: 300,
          course_number_max: 499,
          minimum_credits: 3,
        }),
      }],
    }],
    request: async () => ({ total: 28, courses: selectorCourses }),
    normalizeCandidate: (course) => ({ ...course, prerequisitePaths: [] }),
  });

  assert.equal(hydrated[0].candidates.length, 30);
  assert.equal(hydrated[0].candidates.some(({ code }) => code === "01:640:244"), true);
  assert.equal(hydrated[0].candidates.some(({ code }) => code === "01:640:327"), true);
});
