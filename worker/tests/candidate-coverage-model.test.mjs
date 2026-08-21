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
const optimizerUrl = new URL(
  "../../packages/planner/src/course-set-optimizer.js",
  import.meta.url,
);
if (fs.existsSync(optimizerUrl)) vm.runInNewContext(fs.readFileSync(optimizerUrl, "utf8"), context);
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
  title: `Course ${code}`,
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

test("canonical coverage preserves reviewed credit-exclusion families", () => {
  const graph = model().buildCoverageGraph({
    decisions: [decision("math-elective", "sasnb-mathematics-minor", [
      candidate("01:640:252", {
        creditExclusionFamilies: ["rutgers-nb-differential-equations-credit"],
      }),
    ])],
  });

  assert.deepEqual(plain(graph.candidates[0].creditExclusionFamilies), [
    "rutgers-nb-differential-equations-credit",
  ]);
});

test("completed course facts become optimizer-wide duplicate constraints", () => {
  const graph = model().buildCoverageGraph({
    decisions: [decision("writing", "core", [
      candidate("01:355:103", {
        creditExclusionFamilies: ["rutgers-nb-college-writing-credit"],
      }),
    ])],
    completedCourses: [{
      code: "01:355:101",
      creditExclusionFamilies: ["rutgers-nb-college-writing-credit"],
    }],
  });

  assert.deepEqual(plain(graph.completedCourseCodes), ["01:355:101"]);
  assert.deepEqual(plain(graph.completedCreditExclusionFamilies), [
    "rutgers-nb-college-writing-credit",
  ]);
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

test("a reviewed candidate with no prerequisites replaces a raw metadata fallback", () => {
  const graph = model().buildCoverageGraph({
    decisions: [{
      ...decision("writing", "sas-core", [candidate("01:355:101", {
        title: "College Writing",
        prerequisitePaths: [],
        enforceablePrerequisitePaths: [],
        ruleCoverage: "reviewed",
      })]),
      prerequisiteCourses: [{
        code: "01:355:101",
        title: "College Writing",
        credits: 3,
        prerequisitePaths: [["01:355:100"]],
        enforceablePrerequisitePaths: [["01:355:100"]],
        ruleCoverage: "catalog_parsed",
      }],
    }],
  });

  const collegeWriting = graph.candidates.find((course) => course.code === "01:355:101");
  assert.deepEqual(plain(collegeWriting.prerequisitePaths), []);
  assert.deepEqual(plain(collegeWriting.enforceablePrerequisitePaths), []);
  assert.deepEqual(plain(collegeWriting.prerequisiteClosure), []);
  assert.equal(collegeWriting.ruleCoverage, "reviewed");
});

test("publication readiness removes unresolved prerequisite alternatives without hiding valid paths", () => {
  const graph = model().buildCoverageGraph({
    decisions: [{
      ...decision("math", "mathematics", [candidate("01:640:244", {
        title: "Differential Equations for Engineering and Physics",
        prerequisitePaths: [["01:640:191"], ["01:640:251"]],
        enforceablePrerequisitePaths: [["01:640:191"], ["01:640:251"]],
        ruleCoverage: "catalog_parsed",
      })]),
      prerequisiteCourses: [{
        code: "01:640:251",
        title: "Multivariable Calculus",
        credits: 4,
        prerequisitePaths: [],
        enforceablePrerequisitePaths: [],
        ruleCoverage: "catalog_parsed",
      }],
    }],
  });

  const differentialEquations = graph.candidates.find((course) => course.code === "01:640:244");
  assert.deepEqual(plain(differentialEquations.prerequisitePaths), [["01:640:251"]]);
  assert.deepEqual(plain(differentialEquations.prerequisiteClosure), ["01:640:251"]);
  assert.deepEqual(plain(graph.publicationIssues), [{
    candidateCode: "01:640:244",
    missingCourseCodes: ["01:640:191"],
    type: "incomplete_prerequisite_alternative",
  }]);
});

test("publication readiness excludes a selectable course when every prerequisite path is incomplete", () => {
  const graph = model().buildCoverageGraph({
    decisions: [decision("writing", "sas-core", [candidate("01:830:322", {
      title: "Social Psychology Lab",
      prerequisitePaths: [["01:830:300"]],
      enforceablePrerequisitePaths: [["01:830:300"]],
      ruleCoverage: "catalog_parsed",
    })])],
  });

  assert.equal(graph.candidates.some((course) => course.code === "01:830:322"), false);
  assert.deepEqual(plain(graph.publicationIssues), [{
    candidateCode: "01:830:322",
    missingCourseCodes: ["01:830:300"],
    type: "candidate_not_publication_ready",
  }]);
});

test("publication readiness treats a course-code placeholder as missing academic content", () => {
  const graph = model().buildCoverageGraph({
    decisions: [{
      ...decision("math", "mathematics", [candidate("01:640:135", {
        title: "Calculus I for the Life and Social Sciences",
        prerequisitePaths: [["01:640:025"]],
        enforceablePrerequisitePaths: [["01:640:025"]],
        ruleCoverage: "catalog_parsed",
      })]),
      prerequisiteCourses: [{
        code: "01:640:025",
        title: "01:640:025",
        credits: 3,
        prerequisitePaths: [],
        enforceablePrerequisitePaths: [],
        ruleCoverage: "catalog_parsed",
      }],
    }],
  });

  assert.equal(graph.candidates.some((course) => course.code === "01:640:135"), false);
  assert.equal(graph.candidates.some((course) => course.code === "01:640:025"), false);
  assert.equal(graph.publicationIssues.some((issue) =>
    issue.candidateCode === "01:640:135" && issue.missingCourseCodes.includes("01:640:025")), true);
});

test("canonical prerequisite records preserve their own recursive academic rules", () => {
  const graph = model().buildCoverageGraph({
    decisions: [{
      ...decision("advanced", "sasnb-example", [candidate("01:640:244", {
        prerequisitePaths: [["01:640:251"]],
      })]),
      prerequisiteCourses: [
        { code: "01:640:251", title: "Multivariable Calculus", credits: 4, prerequisitePaths: [["01:640:152"]], enforceablePrerequisitePaths: [["01:640:152"]], ruleCoverage: "catalog_parsed" },
        { code: "01:640:152", title: "Calculus II", credits: 4, prerequisitePaths: [["01:640:151"]], enforceablePrerequisitePaths: [["01:640:151"]], ruleCoverage: "catalog_parsed" },
        { code: "01:640:151", title: "Calculus I", credits: 4, prerequisitePaths: [], enforceablePrerequisitePaths: [], ruleCoverage: "catalog_parsed" },
      ],
    }],
  });

  const multivariable = graph.candidates.find((course) => course.code === "01:640:251");
  assert.deepEqual(plain(multivariable.prerequisitePaths), [["01:640:152"]]);
  assert.deepEqual(plain(multivariable.enforceablePrerequisitePaths), [["01:640:152"]]);
  assert.deepEqual(plain(multivariable.prerequisiteClosure), ["01:640:152"]);
  assert.equal(multivariable.ruleCoverage, "catalog_parsed");

  const result = context.globalThis.ScheduleRUCourseSetOptimizer.optimizeCourseSet(graph);
  assert.deepEqual(plain(result.selectedCourses.map((course) => course.code)), [
    "01:640:151", "01:640:152", "01:640:244", "01:640:251",
  ]);
});

test("the coverage-to-optimizer boundary keeps prerequisite alternatives exclusive", () => {
  const graph = model().buildCoverageGraph({
    decisions: [{
      ...decision("advanced", "sasnb-example", [candidate("01:730:410", {
        title: "History of Analytic Philosophy",
        prerequisitePaths: [["01:355:101"], ["01:355:103"], ["01:355:104"]],
      })]),
      prerequisiteCourses: [
        { code: "01:355:101", title: "College Writing", credits: 3 },
        { code: "01:355:103", title: "Exposition and Argument", credits: 3 },
        { code: "01:355:104", title: "College Writing Extended", credits: 4.5 },
      ],
    }],
  });

  const result = context.globalThis.ScheduleRUCourseSetOptimizer.optimizeCourseSet(graph);

  assert.deepEqual(plain(result.selectedCourses.map((course) => course.code)), [
    "01:355:101",
    "01:730:410",
  ]);
});
