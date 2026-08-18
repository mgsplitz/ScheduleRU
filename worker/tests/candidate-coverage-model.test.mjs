import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL(
  "../../packages/requirements/src/candidate-coverage-model.js",
  import.meta.url,
);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
const plain = (value) => JSON.parse(JSON.stringify(value));

function model() {
  assert.ok(
    context.globalThis.ScheduleRUCandidateCoverageModel,
    "candidate-coverage-model.js must expose ScheduleRUCandidateCoverageModel",
  );
  return context.globalThis.ScheduleRUCandidateCoverageModel;
}

const candidate = (code, extras = {}) => ({
  code,
  title: code,
  credits: 3,
  prerequisitePaths: [],
  ...extras,
});

const decision = (id, program, candidates, extras = {}) => ({
  decisionId: id,
  requirementGroupId: id,
  sourceProgram: program,
  sourceType: "program",
  label: id,
  slotCount: 1,
  candidates,
  ...extras,
});

test("a reviewed equivalent CS course also covers the RBS computing requirement", () => {
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("cs-elective", "sasnb-computer-science-minor", [candidate("01:198:111")]),
      decision("rbs-computing", "rbsnb-foundational-core", [
        candidate("01:198:170"),
        candidate("01:198:111", { equivalentFor: "01:198:170" }),
      ]),
    ],
    equivalencies: [{
      program_id: "rbsnb-foundational-core",
      requirement_course_code: "01:198:170",
      equivalent_course_code: "01:198:111",
      review_status: "reviewed",
    }],
  });

  const intro = graph.candidates.find((item) => item.code === "01:198:111");
  assert.deepEqual(plain(intro.coverageRequirementIds), ["cs-elective", "rbs-computing"]);
  assert.deepEqual(plain(intro.equivalentCourseCodes), ["01:198:111", "01:198:170"]);
  assert.equal(graph.conflicts.length, 0);
});

test("a course can cover Core and program work and two different Core families", () => {
  const course = candidate("01:730:104", { attributes: ["AHp", "WCr"] });
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("philosophy", "sasnb-philosophy-minor", [course]),
      decision("core-ahp", "rutgers-nb-core-curriculum", [course], {
        sourceType: "core", allocationFamily: "AH", coreAttribute: "AHp",
      }),
      decision("core-wcr", "rutgers-nb-core-curriculum", [course], {
        sourceType: "core", allocationFamily: "WCR_WCD", coreAttribute: "WCr",
      }),
    ],
  });

  assert.deepEqual(
    plain(graph.candidates[0].coverageRequirementIds),
    ["core-ahp", "core-wcr", "philosophy"],
  );
  assert.equal(graph.conflicts.length, 0);
});

test("one course cannot fill two requirements in the same Core allocation family", () => {
  const course = candidate("01:730:104", { attributes: ["WCr", "WCd"] });
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("core-wcr", "rutgers-nb-core-curriculum", [course], {
        sourceType: "core", allocationFamily: "WCR_WCD", coreAttribute: "WCr",
      }),
      decision("core-wcd", "rutgers-nb-core-curriculum", [course], {
        sourceType: "core", allocationFamily: "WCR_WCD", coreAttribute: "WCd",
      }),
    ],
  });

  assert.deepEqual(plain(graph.conflicts), [{
    type: "allocation_family",
    candidateCode: "01:730:104",
    requirementIds: ["core-wcd", "core-wcr"],
    allocationFamily: "WCR_WCD",
  }]);
});

test("an RBS major and concentration overlap is forbidden without a named exception", () => {
  const shared = candidate("33:390:435");
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("finance", "rbsnb-finance", [shared]),
      decision("real-estate", "rbsnb-real-estate-concentration", [shared]),
    ],
    policies: {
      programs: [
        { id: "rbsnb-finance", type: "major", school_slug: "rbsnb" },
        { id: "rbsnb-real-estate-concentration", type: "concentration", school_slug: "rbsnb" },
      ],
      doubleCountPolicies: [{ school_slug: "rbsnb", scope: "major_concentration", max_shared_courses: 0 }],
      doubleCountExceptions: [],
    },
  });

  assert.equal(graph.conflicts[0].type, "double_count_cap");
  assert.equal(graph.conflicts[0].maxSharedCourses, 0);
});

test("a reviewed course-specific exception permits only its named course", () => {
  const allowed = candidate("33:390:435");
  const blocked = candidate("33:390:440");
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("finance", "rbsnb-finance", [allowed, blocked]),
      decision("real-estate", "rbsnb-real-estate-concentration", [allowed, blocked]),
    ],
    policies: {
      programs: [
        { id: "rbsnb-finance", type: "major", school_slug: "rbsnb" },
        { id: "rbsnb-real-estate-concentration", type: "concentration", school_slug: "rbsnb" },
      ],
      doubleCountPolicies: [{ school_slug: "rbsnb", scope: "major_concentration", max_shared_courses: 0 }],
      doubleCountExceptions: [{
        program_a: "rbsnb-finance",
        program_b: "rbsnb-real-estate-concentration",
        allowed_course_codes: ["33:390:435"],
        review_status: "reviewed",
      }],
    },
  });

  assert.equal(graph.conflicts.some((item) => item.candidateCode === "33:390:435"), false);
  assert.equal(graph.conflicts.some((item) => item.candidateCode === "33:390:440"), true);
});

test("missing cross-program double-count authority is an explicit review conflict", () => {
  const shared = candidate("01:730:103");
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("major", "sasnb-philosophy-major", [shared]),
      decision("minor", "sasnb-religion-minor", [shared]),
    ],
    policies: {
      programs: [
        { id: "sasnb-philosophy-major", type: "major", school_slug: "sasnb" },
        { id: "sasnb-religion-minor", type: "minor", school_slug: "sasnb" },
      ],
    },
  });

  assert.deepEqual(plain(graph.conflicts), [{
    type: "double_count_unknown",
    candidateCode: "01:730:103",
    programIds: ["sasnb-philosophy-major", "sasnb-religion-minor"],
  }]);
});

test("equivalent catalog codes form one credit-bearing candidate", () => {
  const graph = model().buildCoverageGraph({
    decisions: [
      decision("statistics", "rbsnb-foundational-core", [
        candidate("01:960:211", { credits: 3 }),
        candidate("01:960:285", { credits: 3 }),
      ]),
    ],
    equivalencies: [{
      program_id: "rbsnb-foundational-core",
      requirement_course_code: "01:960:285",
      equivalent_course_code: "01:960:211",
      review_status: "reviewed",
    }],
  });

  assert.equal(graph.candidates.length, 1);
  assert.equal(graph.candidates[0].credits, 3);
  assert.deepEqual(plain(graph.candidates[0].equivalentCourseCodes), ["01:960:211", "01:960:285"]);
});

test("canonical prerequisite records keep prerequisite-only recommendations readable", () => {
  const graph = model().buildCoverageGraph({
    decisions: [{
      ...decision("advanced", "sasnb-example", [candidate("01:730:424", {
        title: "Logic of Decision",
        prerequisitePaths: [["01:730:407"]],
      })]),
      prerequisiteCourses: [{ code: "01:730:407", title: "Intermediate Logic I", credits: 3 }],
    }],
  });

  const prerequisite = graph.candidates.find((course) => course.code === "01:730:407");
  assert.equal(prerequisite.title, "Intermediate Logic I");
  assert.deepEqual(plain(prerequisite.coverageRequirementIds), []);
});
