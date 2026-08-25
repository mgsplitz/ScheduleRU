import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { compilePublicCourseRules } from "../../apps/api/src/programs.js";
import { programDefinition } from "./helpers/catalog-snapshot.mjs";

const PROGRAM_IDS = [
  "rbsnb-bait",
  "rbsnb-finance",
  "sasnb-computer-science-minor",
  "sasnb-mathematics-minor",
  "sasnb-philosophy-minor",
];
const context = { globalThis: {} };
for (const file of [
  "packages/planner/src/eligibility-logic.js",
  "packages/requirements/src/course-selector-logic.js",
  "packages/requirements/src/academic-credit-logic.js",
  "packages/requirements/src/requirement-tree-builder.js",
  "packages/planner/src/requirement-choice-logic.js",
  "packages/planner/src/planner-input-logic.js",
  "packages/requirements/src/candidate-coverage-model.js",
  "packages/planner/src/course-set-optimizer.js",
  "packages/planner/src/four-year-planner-logic.js",
]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"), context);
}
const root = context.globalThis;
const referenceData = JSON.parse(fs.readFileSync(
  new URL("../../reference-data/snapshots/reviewed-reference-data.v1.json", import.meta.url),
  "utf8",
));
const substitutions = referenceData.course_prerequisite_substitutions;
const exclusionFamilies = new Map();
for (const member of referenceData.course_credit_exclusion_members) {
  const rows = exclusionFamilies.get(member.course_code) || [];
  rows.push(member.policy_key);
  exclusionFamilies.set(member.course_code, rows);
}

const academicFacts = {
  "01:198:111": { prereqs: "Any Course EQUAL or GREATER Than: 01:640:112 PRECALCULUS PART II" },
  "01:198:112": { prereqs: "01:198:111 INTRODUCTION TO COMPUTER SCIENCE" },
  "01:198:205": { prereqs: "01:198:112 DATA STRUCTURES" },
  "01:198:206": { prereqs: "01:198:205 INTRODUCTION TO DISCRETE STRUCTURES I" },
  "01:198:314": { prereqs: "01:198:112 DATA STRUCTURES" },
  "01:198:425": { prereqs: "(01:198:206 INTRODUCTION TO DISCRETE STRUCTURES II or 01:640:477 MATHEMATICAL THEORY OF PROBABILITY) and 01:640:152 CALCULUS II" },
  "01:198:461": { prereqs: "(01:198:206 INTRODUCTION TO DISCRETE STRUCTURES II or 01:640:477 MATHEMATICAL THEORY OF PROBABILITY) and 01:640:152 CALCULUS II" },
  "01:640:151": { prereqs: "Any Course EQUAL or GREATER Than: 01:640:112 PRECALCULUS PART II" },
  "01:640:152": { prereqs: "01:640:151 CALCULUS I" },
  "01:640:251": { prereqs: "01:640:152 CALCULUS II" },
  "01:640:244": { prereqs: "01:640:251 MULTIVARIABLE CALCULUS and 01:640:250 INTRODUCTION TO LINEAR ALGRA" },
  "01:640:252": { prereqs: "01:640:251 MULTIVARIABLE CALCULUS and 01:640:250 INTRODUCTION TO LINEAR ALGRA" },
  "01:640:311": { prereqs: "01:640:251 MULTIVARIABLE CALCULUS" },
  "01:640:477": { prereqs: "01:640:152 CALCULUS II" },
  "33:390:440": { prereqs: "33:390:400 CORPORATE FINANCE", restrictions: "FINANCE MAJORS ONLY; JUNIORS AND SENIORS" },
};

function compiledCourse(course, ownerProgramId) {
  const code = course.code;
  const fact = academicFacts[code] || {};
  const families = exclusionFamilies.get(code) || [];
  const eligibility = families.length ? {
    review: null,
    conditions: [],
    credit_exclusions: families.map((policy_key) => ({ policy_key })),
  } : null;
  const row = {
    group_id: "",
    course_code: code,
    note: course.note || "",
    source_title: course.title,
    source_credits: course.credits == null ? "3" : String(course.credits),
    owner_program_id: ownerProgramId,
    catalog_title: course.title,
    catalog_credits: course.credits == null ? "3" : String(course.credits),
    catalog_prereqs: fact.prereqs || "",
    section_restrictions: fact.restrictions || "",
    catalog_record_available: true,
    eligibility,
  };
  row.compiled_rules = compilePublicCourseRules(row, substitutions);
  return row;
}

function apiRequirementRoots(programIds) {
  const byId = new Map();
  for (const programId of programIds) {
    for (const group of programDefinition(programId).requirement_groups) {
      const existing = byId.get(group.id);
      const sourceProgramIds = [...new Set([...(existing?.sourceProgramIds || []), programId])];
      byId.set(group.id, {
        ...group,
        program_id: group.program_id || programId,
        sourceProgramIds,
        course_selectors: (group.selectors || []).map((selector) => ({
          selector_json: selector.selector,
          selector_key: selector.key,
        })),
        courses: group.courses.map((course) => ({
          ...compiledCourse(course, programId),
          group_id: group.id,
        })),
        children: [],
      });
    }
  }
  for (const group of byId.values()) {
    if (group.parent_group_id && byId.has(group.parent_group_id)) {
      byId.get(group.parent_group_id).children.push(group);
    }
  }
  return [...byId.values()].filter((group) => !group.parent_group_id);
}

const guidedPools = {
  "rbsnb-foundational-core-g1-or1": [
    ["01:640:151", "Calculus I for Mathematical and Physical Sciences", 4],
  ],
  "rbsnb-bait-g1-or1": [["33:136:370", "Management Information Systems", 3]],
  "rbsnb-bait-g1-or2": [["33:522:334", "Business Ethics", 3]],
  "rbsnb-bait-g3": [["33:136:486", "Optimization Modeling", 3]],
  "rbsnb-finance-g1-or1": [["33:136:370", "Management Information Systems", 3]],
  "rbsnb-finance-g1-or2": [["33:522:334", "Business Ethics", 3]],
  "rbsnb-finance-g3": [
    ["33:010:472", "Analysis of Financial Statements", 3],
    ["33:390:385", "Investment Banking Analysis", 3],
    ["33:390:410", "Asset Pricing and Portfolio Analysis", 3],
    ["33:390:440", "Advanced Corporate Finance", 3],
  ],
  "sasnb-computer-science-minor-approved-courses": [
    ["01:198:111", "Introduction to Computer Science", 4],
    ["01:198:112", "Data Structures", 4],
    ["01:198:205", "Introduction to Discrete Structures I", 4],
    ["01:198:206", "Introduction to Discrete Structures II", 4],
    ["01:198:314", "Principles of Programming Languages", 4],
    ["01:198:425", "Brain-Inspired Computing", 4],
    ["01:198:461", "Machine Learning Principles", 4],
  ],
  "sasnb-computer-science-minor-upper-level": [
    ["01:198:425", "Brain-Inspired Computing", 4],
    ["01:198:461", "Machine Learning Principles", 4],
  ],
  "sasnb-mathematics-minor-electives": [
    ["01:640:244", "Differential Equations for Engineering and Physics", 3],
    ["01:640:252", "Elementary Differential Equations", 3],
    ["01:640:300", "Introduction to Mathematical Reasoning", 3],
    ["01:640:311", "Introduction to Real Analysis I", 3],
    ["01:640:477", "Mathematical Theory of Probability", 3],
  ],
  "sasnb-philosophy-minor-total": [
    ["01:730:104", "Introduction to Philosophy - Writing Intensive", 4],
    ["01:730:330", "Ethics of Harming and Helping", 3],
    ["01:730:344", "Marx, Nietzsche, Freud", 3],
    ["01:730:371", "Philosophies of Death and Dying", 3],
    ["01:730:424", "Logic of Decision", 3],
    ["01:730:429", "Philosophy of Biology", 3],
  ],
  "sasnb-philosophy-minor-upper-level": [
    ["01:730:330", "Ethics of Harming and Helping", 3],
    ["01:730:344", "Marx, Nietzsche, Freud", 3],
    ["01:730:371", "Philosophies of Death and Dying", 3],
    ["01:730:424", "Logic of Decision", 3],
    ["01:730:429", "Philosophy of Biology", 3],
  ],
};

function candidate([code, title, credits], sourceProgram) {
  const row = compiledCourse({ code, title, credits, note: "" }, sourceProgram);
  return {
    code,
    title,
    credits,
    ...row.compiled_rules,
  };
}

function earlier(left, right) {
  const ordinal = (entry) => (entry.year - 1) * 2 + (entry.sem === "spring" ? 1 : 0);
  return ordinal(left) < ordinal(right);
}

test("BAIT and Finance with CS, Mathematics, and Philosophy minors produces only academically legal placements", () => {
  const requirements = apiRequirementRoots(["rbsnb-foundational-core", ...PROGRAM_IDS]);
  const tree = root.ScheduleRURequirementTreeBuilder.build(requirements);
  const terms = Array.from({ length: 8 }, (_, index) => ({
    year: Math.floor(index / 2) + 1,
    sem: index % 2 ? "spring" : "fall",
  }));
  const initial = root.ScheduleRUPlannerInput.buildPlannerInput({
    terms,
    requirementTrees: [{ id: "selected-programs", tree }],
  });
  const prerequisiteCourses = [
    ...Object.values(tree.courses).map((course) => root.ScheduleRUPlannerInput.normalizedCourse(course)),
    ...Object.entries(guidedPools).flatMap(([groupId, rows]) =>
      rows.map((row) => candidate(row, groupId))),
  ];
  const decisions = initial.planningDecisions.map((decision) => {
    const rows = guidedPools[decision.requirementGroupId];
    const candidates = rows
      ? rows.map((row) => candidate(row, decision.sourceProgram))
      : decision.candidates;
    return { ...decision, candidates, prerequisiteCourses };
  });
  const graph = root.ScheduleRUCandidateCoverageModel.buildCoverageGraph({
    decisions,
    plannedCourseCodes: initial.courses.map(({ code }) => code),
    policies: {
      programs: PROGRAM_IDS.map((id) => ({
        id,
        type: id.startsWith("rbsnb-") ? "major" : "minor",
        school_slug: id.startsWith("rbsnb-") ? "rbsnb" : "sasnb",
      })),
      doubleCountPolicies: referenceData.double_count_policies,
      doubleCountExceptions: referenceData.double_count_exceptions,
    },
  });
  const requirementIds = new Set(graph.requirements.map(({ id }) => id));
  for (const candidateRow of graph.candidates) {
    const staleIds = candidateRow.coverageRequirementIds.filter((id) => !requirementIds.has(id));
    assert.equal(staleIds.length, 0, `${candidateRow.code} has stale coverage requirement ids: ${staleIds.join(", ")}`);
  }
  for (const equivalentCode of ["01:198:206", "01:640:477"]) {
    assert.equal(
      graph.candidates.find(({ code }) => code === equivalentCode)?.creditExclusionFamilies
        ?.includes("rutgers-nb-probability-credit"),
      true,
      `${equivalentCode} must retain its canonical credit-exclusion family`,
    );
  }
  const preferences = Object.fromEntries(graph.requirements.map((requirement) => [
    requirement.id,
    { mode: "recommend_for_me", interested: [], maybe: [], avoid: [] },
  ]));
  preferences.__global = { interested: [], maybe: [], avoid: [] };
  const optimization = root.ScheduleRUCourseSetOptimizer.optimizeCourseSet(graph, preferences);

  assert.equal(optimization.status, "complete", JSON.stringify(optimization.issues));
  const selectedCodes = new Set(optimization.selectedCourses.map(({ code }) => code));
  assert.equal(selectedCodes.has("01:640:252") && selectedCodes.has("01:640:244"), false);
  assert.equal(selectedCodes.has("01:198:206") && selectedCodes.has("01:640:477"), false);

  const approved = root.ScheduleRUPlannerInput.applyApprovedCourseSet(initial, optimization);
  const preview = root.ScheduleRUFourYearPlanner.generatePlan(approved);
  const scheduledCodes = new Set(Object.keys(preview.schedule));

  for (const falseRemedialCourse of ["01:640:001", "01:640:025", "01:640:026"]) {
    assert.equal(scheduledCodes.has(falseRemedialCourse), false);
  }
  for (const [code, paths] of Object.entries(approved.enforceablePrerequisitePathsByCode)) {
    if (!preview.schedule[code]) continue;
    assert.ok(paths.some((path) => path.every((prerequisiteCode) =>
      approved.completedCourseCodes.includes(prerequisiteCode)
      || (preview.schedule[prerequisiteCode] && earlier(preview.schedule[prerequisiteCode], preview.schedule[code]))
    )), `${code} must follow one complete prerequisite path`);
  }
  for (const course of approved.courses) {
    if (course.minimumPlanYear && preview.schedule[course.code]) {
      assert.ok(preview.schedule[course.code].year >= course.minimumPlanYear, `${course.code} class standing`);
    }
  }
  assert.ok(Object.values(preview.termCredits).every((credits) => credits <= 18));
  assert.equal(preview.schedule["33:390:440"]?.year >= 3, true);
  assert.equal(preview.status, "partial");
  assert.ok(preview.issues.some((issue) => ["plan_capacity_exceeded", "plan_sequence_capacity_exceeded", "courses_unplaced"].includes(issue.code)));
});
