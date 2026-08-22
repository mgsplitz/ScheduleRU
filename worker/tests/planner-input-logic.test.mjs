import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {} };
const eligibilityUrl = new URL(
  "../../packages/planner/src/eligibility-logic.js",
  import.meta.url,
);
vm.runInNewContext(fs.readFileSync(eligibilityUrl, "utf8"), context);
const selectorUrl = new URL(
  "../../packages/requirements/src/course-selector-logic.js",
  import.meta.url,
);
vm.runInNewContext(fs.readFileSync(selectorUrl, "utf8"), context);
const academicCreditUrl = new URL(
  "../../packages/requirements/src/academic-credit-logic.js",
  import.meta.url,
);
vm.runInNewContext(fs.readFileSync(academicCreditUrl, "utf8"), context);
const requirementChoiceUrl = new URL(
  "../../packages/planner/src/requirement-choice-logic.js",
  import.meta.url,
);
if (fs.existsSync(requirementChoiceUrl)) {
  vm.runInNewContext(fs.readFileSync(requirementChoiceUrl, "utf8"), context);
}
const moduleUrl = new URL(
  "../../packages/planner/src/planner-input-logic.js",
  import.meta.url,
);
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
const plannerUrl = new URL(
  "../../packages/planner/src/four-year-planner-logic.js",
  import.meta.url,
);
vm.runInNewContext(fs.readFileSync(plannerUrl, "utf8"), context);
const logic = context.globalThis.ScheduleRUPlannerInput;
const planner = context.globalThis.ScheduleRUFourYearPlanner;
const plannerInput = () => {
  assert.ok(logic, "ScheduleRUPlannerInput must be exposed on globalThis");
  return logic;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("normalizing an authoritative course fact record is lossless", () => {
  const normalized = plannerInput().normalizedCourse({
    code: "33:390:440",
    title: "Advanced Corporate Finance",
    credits: 3,
    prerequisitePaths: [["33:390:400"]],
    enforceablePrerequisitePaths: [["33:390:400"]],
    corequisitePaths: [["33:390:300"]],
    minimumPlanYear: 3,
    minimumPriorCredits: 60,
    ruleCoverage: "reviewed",
    optionFamily: "finance:advanced-elective-alternatives",
    creditExclusionFamilies: ["finance:advanced-elective-alternatives"],
  });

  assert.deepEqual(plain(normalized.prerequisitePaths), [["33:390:400"]]);
  assert.deepEqual(plain(normalized.enforceablePrerequisitePaths), [["33:390:400"]]);
  assert.deepEqual(plain(normalized.corequisitePaths), [["33:390:300"]]);
  assert.equal(normalized.minimumPlanYear, 3);
  assert.equal(normalized.minimumPriorCredits, 60);
  assert.equal(normalized.ruleCoverage, "reviewed");
  assert.equal(normalized.optionFamily, "finance:advanced-elective-alternatives");
  assert.deepEqual(plain(normalized.creditExclusionFamilies), [
    "finance:advanced-elective-alternatives",
  ]);
});

test("catalog-parsed facts outside the active degree path remain advisory", () => {
  const normalized = plannerInput().normalizedCourse({
    code: "01:640:151",
    title: "Calculus I",
    credits: 4,
    prerequisitePaths: [["01:640:115"], ["01:640:112"]],
    enforceablePrerequisitePaths: [["01:640:115"], ["01:640:112"]],
    ruleCoverage: "catalog_parsed",
  }, {
    knownCourseCodes: new Set(["01:640:151", "01:640:152"]),
    completedCourseCodes: new Set(),
  });

  assert.deepEqual(plain(normalized.prerequisitePaths), [["01:640:115"], ["01:640:112"]]);
  assert.deepEqual(plain(normalized.enforceablePrerequisitePaths), []);
});

test("catalog-parsed facts enforce only complete paths available in the active degree plan", () => {
  const normalized = plannerInput().normalizedCourse({
    code: "01:640:300",
    title: "Introduction to Mathematical Reasoning",
    credits: 3,
    prerequisitePaths: [["01:640:250"], ["01:640:350"], ["21:640:350"]],
    enforceablePrerequisitePaths: [["01:640:250"], ["01:640:350"], ["21:640:350"]],
    ruleCoverage: "catalog_parsed",
  }, {
    knownCourseCodes: new Set(["01:640:250", "01:640:300", "01:640:350"]),
    completedCourseCodes: new Set(),
  });

  assert.deepEqual(plain(normalized.prerequisitePaths), [
    ["01:640:250"],
    ["01:640:350"],
    ["21:640:350"],
  ]);
  assert.deepEqual(plain(normalized.enforceablePrerequisitePaths), [
    ["01:640:250"],
    ["01:640:350"],
  ]);
});

test("reviewed credit exclusions become planner constraint families", () => {
  const normalized = plannerInput().normalizedCourse({
    code: "01:640:252",
    title: "Elementary Differential Equations",
    credits: 3,
    eligibility: {
      review: null,
      conditions: [],
      credit_exclusions: [{
        policy_key: "rutgers-nb-differential-equations-credit",
        max_courses: 1,
      }],
    },
  });

  assert.deepEqual(plain(normalized.creditExclusionFamilies), [
    "rutgers-nb-differential-equations-credit",
  ]);
});

function sampleTree() {
  return {
    roots: ["root"],
    courses: {
      calc: {
        code: "01:640:151", title: "Calculus I", credits: "4",
        alternatives: [{ code: "01:640:135" }],
      },
      intro: {
        code: "01:198:111", title: "Introduction to Computer Science", credits: "",
      },
      data: {
        code: "01:198:205", title: "Introduction to Discrete Structures II", credits: "4",
        catalogPrereqs: "01:198:111 or 14:332:221",
      },
      junior: {
        code: "33:136:388", title: "Foundations of Business Programming", credits: "3",
        requirementNotes: ["Not open to first-year students"],
      },
      electiveA: { code: "01:198:314", title: "Principles of Programming Languages", credits: "4" },
      electiveB: { code: "01:198:323", title: "Numerical Analysis", credits: "4" },
      electiveC: { code: "01:198:336", title: "Principles of Information and Data Management", credits: "4" },
      physicsA: { code: "01:750:203", title: "General Physics", credits: "3" },
      physicsB: { code: "01:750:204", title: "General Physics II", credits: "3" },
      chemistryA: { code: "01:160:159", title: "General Chemistry", credits: "4" },
      chemistryB: { code: "01:160:160", title: "General Chemistry II", credits: "4" },
    },
    groups: {
      root: { id: "root", rule: "all", members: [], children: ["fixed", "electives", "science"] },
      fixed: { id: "fixed", name: "Required courses", rule: "all", members: ["calc", "intro", "data", "junior"], children: [], parentId: "root" },
      electives: { id: "electives", name: "Choose two electives", rule: "min", count: 2, members: ["electiveA", "electiveB", "electiveC"], children: [], parentId: "root" },
      science: { id: "science", name: "Choose one science sequence", rule: "one_of", count: 1, members: [], children: ["physics", "chemistry"], parentId: "root" },
      physics: { id: "physics", name: "Physics sequence", rule: "all", members: ["physicsA", "physicsB"], children: [], parentId: "science" },
      chemistry: { id: "chemistry", name: "Chemistry sequence", rule: "all", members: ["chemistryA", "chemistryB"], children: [], parentId: "science" },
    },
  };
}

function build(overrides = {}) {
  return plannerInput().buildPlannerInput({
    terms: Array.from({ length: 8 }, (_, ordinal) => ({
      year: Math.floor(ordinal / 2) + 1,
      sem: ordinal % 2 ? "spring" : "fall",
    })),
    requirementTrees: [{ id: "sasnb-computer-science-bs", tree: sampleTree() }],
    groupSelections: {},
    schedule: {},
    wishlistCourses: [],
    completedCourseCodes: [],
    ...overrides,
  });
}

test("fixed courses stay concrete while elective and one-of choices stay typed", () => {
  const result = build();
  assert.deepEqual(plain(result.courses.map((course) => course.code).sort()), [
    "01:198:111", "01:198:205", "01:640:151", "33:136:388",
  ]);
  assert.deepEqual(plain(result.unresolvedRequirements.map((item) => item.requirementGroupId).sort()), [
    "electives", "electives", "science",
  ]);
  assert.equal(result.unresolvedRequirements.find((item) => item.requirementGroupId === "science").kind, "choice_placeholder");
  assert.equal(result.planningDecisions.find((item) => item.requirementGroupId === "electives").planningMode, "guided_flexible");
  assert.equal(result.planningDecisions.find((item) => item.requirementGroupId === "electives").slotCount, 2);
});

test("planner decisions retain candidate-specific prerequisite summaries", () => {
  const tree = sampleTree();
  tree.courses.electiveA.catalogPrereqs = "01:198:111";
  tree.courses.electiveB.catalogPrereqs = "01:640:151";

  const result = build({ requirementTrees: [{ id: "sasnb-computer-science-bs", tree }] });
  const decision = result.planningDecisions.find((item) => item.requirementGroupId === "electives");

  assert.equal(decision.planningMode, "sequence_critical");
  assert.deepEqual(plain(decision.candidates.find((item) => item.code === "01:198:314").prerequisitePaths), [["01:198:111"]]);
  assert.deepEqual(plain(decision.candidates.find((item) => item.code === "01:198:323").prerequisitePaths), [["01:640:151"]]);
});

test("reviewed alternatives become concrete optimizer candidates in one equivalence family", () => {
  const tree = sampleTree();
  tree.courses.electiveA.alternatives = [{
    code: "01:198:111", title: "Introduction to Computer Science", credits: "4",
  }];
  const result = build({ requirementTrees: [{ id: "program", tree }] });
  const decision = result.planningDecisions.find((item) => item.requirementGroupId === "electives");
  const primary = decision.candidates.find((item) => item.code === "01:198:314");
  const alternative = decision.candidates.find((item) => item.code === "01:198:111");

  assert.ok(alternative);
  assert.equal(alternative.equivalenceKey, primary.equivalenceKey);
});

test("only an approved complete recommendation replaces its covered placeholders", () => {
  const input = build();
  const untouched = plannerInput().applyApprovedCourseSet(input, {
    status: "incomplete", selectedCourses: [],
  });
  assert.equal(untouched, input);

  const applied = plannerInput().applyApprovedCourseSet(input, {
    status: "complete",
    selectedCourses: [
      {
        code: "01:198:314", title: "Principles of Programming Languages", credits: 4,
        coverageRequirementIds: ["program:sasnb-computer-science-bs:electives"],
        prerequisitePaths: [["01:198:111"]], enforceablePrerequisitePaths: [["01:198:111"]],
      },
      {
        code: "01:198:323", title: "Numerical Analysis", credits: 4,
        coverageRequirementIds: ["program:sasnb-computer-science-bs:electives"],
        prerequisitePaths: [], enforceablePrerequisitePaths: [],
      },
    ],
  });

  assert.equal(applied.unresolvedRequirements.filter((item) => item.requirementGroupId === "electives").length, 0);
  assert.equal(applied.courses.some((item) => item.code === "01:198:314"), true);
  assert.deepEqual(plain(applied.prerequisitePathsByCode["01:198:314"]), [["01:198:111"]]);
});

test("a completed approved alternative satisfies the canonical requirement course", () => {
  const result = build({ completedCourseCodes: ["01:640:135"] });
  assert.ok(result.completedCourseCodes.includes("01:640:151"));
  assert.ok(!result.courses.some((course) => course.code === "01:640:151"));
});

test("completed and AP-satisfied members reduce unresolved choice-group counts", () => {
  const tree = sampleTree();
  tree.groups.root.children = ["writing", "quantitative"];
  tree.groups.writing = {
    id: "writing", name: "College Writing", rule: "min_courses", count: 1,
    members: ["writing101", "writing103"], children: [], parentId: "root",
  };
  tree.groups.quantitative = {
    id: "quantitative", name: "Quantitative Methods", rule: "min_courses", count: 1,
    members: ["calc", "statistics"], children: [], parentId: "root",
  };
  tree.courses.writing101 = {
    code: "01:355:101", title: "Expository Writing", credits: "3",
  };
  tree.courses.writing103 = {
    code: "01:355:103", title: "Basic Composition", credits: "3",
  };
  tree.courses.statistics = {
    code: "01:960:211", title: "Statistics I", credits: "3",
  };

  const result = build({
    requirementTrees: [],
    coreTree: tree,
    completedCourseCodes: ["01:355:101", "01:640:135"],
  });

  assert.equal(result.unresolvedRequirements.some((item) => item.requirementGroupId === "writing"), false);
  assert.equal(result.unresolvedRequirements.some((item) => item.requirementGroupId === "quantitative"), false);
});

test("a concrete course required by one tree satisfies a choice in another tree", () => {
  const programTree = sampleTree();
  programTree.groups.root.children = ["fixed"];
  programTree.groups.fixed.members = ["calc"];

  const coreTree = sampleTree();
  coreTree.groups.root.children = ["quantitative"];
  coreTree.groups.quantitative = {
    id: "quantitative",
    name: "Calculus I (choose 1)",
    rule: "min",
    count: 1,
    members: ["calc", "statistics"],
    children: [],
    parentId: "root",
  };
  coreTree.courses.statistics = {
    code: "01:960:211",
    title: "Statistics I",
    credits: "3",
  };

  const result = build({
    requirementTrees: [{ id: "math", tree: programTree }],
    coreTree,
  });

  assert.equal(result.courses.filter((course) => course.code === "01:640:151").length, 1);
  assert.equal(
    result.unresolvedRequirements.some((item) => item.requirementGroupId === "quantitative"),
    false,
  );
});

test("an explicitly pinned approved alternative is preserved while its canonical requirement is suppressed", () => {
  const tree = sampleTree();
  tree.courses.businessComputer = {
    code: "01:198:170",
    title: "Computer Applications for Business",
    credits: "3",
    alternatives: [{ code: "01:198:111" }],
  };
  tree.groups.fixed.members = ["businessComputer"];

  const result = build({
    requirementTrees: [{ id: "rbs", tree }],
    schedule: {
      intro: {
        code: "01:198:111",
        title: "Introduction to Computer Science",
        credits: 4,
        year: 1,
        sem: "fall",
        locked: true,
        userPinned: true,
      },
    },
  });

  assert.equal(result.courses.some((course) => course.code === "01:198:170"), false);
  assert.equal(result.courses.some((course) => course.code === "01:198:111"), true);
  assert.equal(result.completedCourseCodes.includes("01:198:111"), false);
});

test("future reviewed alternatives suppress redundant canonical courses without suppressing unrelated requirements", () => {
  const tree = sampleTree();
  tree.courses.businessComputer = {
    code: "01:198:170",
    title: "Computer Applications for Business",
    credits: "3",
    alternatives: [{ code: "01:198:111" }],
  };
  tree.courses.statisticalMethods = {
    code: "33:136:385",
    title: "Statistical Methods in Business",
    credits: "3",
  };
  tree.groups.fixed.members = ["intro", "businessComputer", "statisticalMethods"];

  const result = build({
    requirementTrees: [{ id: "rbs", tree }],
  });
  const codes = new Set(result.courses.map((course) => course.code));

  assert.equal(codes.has("01:198:111"), true);
  assert.equal(codes.has("01:198:170"), false);
  assert.equal(codes.has("33:136:385"), true);
});

test("regeneration rebuilds unlocked generated equivalents from requirements", () => {
  const tree = sampleTree();
  tree.courses.businessComputer = {
    code: "01:198:170",
    title: "Computer Applications for Business",
    credits: "3",
    alternatives: [{ code: "01:198:111" }],
  };
  tree.groups.fixed.members = ["intro", "businessComputer"];

  const result = build({
    requirementTrees: [{ id: "combined-programs", tree }],
    schedule: {
      intro: {
        code: "01:198:111", title: "Introduction to Computer Science", credits: 4,
        year: 1, sem: "fall", locked: false, userPinned: false,
      },
      businessComputer: {
        code: "01:198:170", title: "Computer Applications for Business", credits: 3,
        year: 1, sem: "spring", locked: false, userPinned: false,
      },
    },
  });
  const codes = new Set(result.courses.map((course) => course.code));

  assert.equal(codes.has("01:198:111"), true);
  assert.equal(codes.has("01:198:170"), false);
});

test("regeneration preserves an explicitly pinned canonical equivalent", () => {
  const tree = sampleTree();
  tree.courses.businessComputer = {
    code: "01:198:170",
    title: "Computer Applications for Business",
    credits: "3",
    alternatives: [{ code: "01:198:111" }],
  };
  tree.groups.fixed.members = ["intro", "businessComputer"];

  const result = build({
    requirementTrees: [{ id: "combined-programs", tree }],
    schedule: {
      businessComputer: {
        code: "01:198:170", title: "Computer Applications for Business", credits: 3,
        year: 2, sem: "fall", locked: true, userPinned: true,
      },
    },
  });

  assert.equal(result.lockedPlacements["01:198:170"].year, 2);
  assert.equal(result.courses.some((course) => course.code === "01:198:170"), true);
});

test("completed alternatives close transitively before planner courses are collected", () => {
  const requirementTree = sampleTree();
  requirementTree.courses.intro.alternatives = [{ code: "01:198:110" }];
  requirementTree.courses.businessComputer = {
    code: "01:198:170",
    title: "Computer Applications for Business",
    credits: "3",
    alternatives: [{ code: "01:198:111" }],
  };
  requirementTree.groups.fixed.members.push("businessComputer");

  const result = build({
    completedCourseCodes: ["01:198:110"],
    requirementTrees: [
      {
        id: "business",
        tree: {
          roots: ["business-root"],
          groups: {
            "business-root": {
              id: "business-root", rule: "all", members: ["informationSystems"], children: [],
            },
          },
          courses: {
            informationSystems: {
              code: "33:136:370",
              alternatives: [{ code: "01:198:170" }],
            },
          },
        },
      },
      { id: "computer-science", tree: requirementTree },
    ],
  });

  assert.ok(result.completedCourseCodes.includes("01:198:111"));
  assert.ok(result.completedCourseCodes.includes("01:198:170"));
  assert.ok(result.completedCourseCodes.includes("33:136:370"));
  assert.ok(!result.courses.some((course) => ["01:198:111", "01:198:170", "33:136:370"].includes(course.code)));
});

test("missing credits remain visible as a three-credit estimate instead of zero", () => {
  const result = build();
  const intro = result.courses.find((course) => course.code === "01:198:111");
  assert.equal(intro.credits, 3);
  assert.equal(intro.creditsEstimated, true);
  assert.ok(result.issues.some((issue) => issue.code === "estimated_course_credits" && issue.courseCode === intro.code));
});

test("catalog alternatives and standing restrictions survive planner normalization", () => {
  const result = build();
  assert.deepEqual(plain(result.prerequisitePathsByCode["01:198:205"]), [["01:198:111"], ["14:332:221"]]);
  assert.equal(result.courses.find((course) => course.code === "33:136:388").minimumPlanYear, 2);
});

test("a reviewed no-condition course never falls back to raw catalog prerequisite text", () => {
  const tree = {
    roots: ["writing"],
    courses: {
      collegeWriting: {
        code: "01:355:101",
        title: "COLLEGE WRITING",
        credits: "3",
        catalogPrereqs: "01:355:100 BASIC COMPOSITION OR 01:356:156 ACADEMIC WRITING",
        eligibility: {
          review: {
            course_code: "01:355:101",
            review_status: "reviewed",
            no_known_conditions: 1,
          },
          conditions: [],
        },
      },
    },
    groups: {
      writing: {
        id: "writing",
        name: "College Writing",
        rule: "all",
        members: ["collegeWriting"],
        children: [],
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "sas-core", tree }] });
  assert.deepEqual(plain(result.prerequisitePathsByCode["01:355:101"] || []), []);
  assert.equal(result.courses.find((course) => course.code === "01:355:101")?.ruleCoverage, "reviewed");
  assert.equal(result.courses.some((course) => ["01:355:100", "01:356:156"].includes(course.code)), false);
});

test("advanced microeconomics exposes both complete prerequisite paths to the planner", () => {
  const tree = sampleTree();
  tree.courses.advancedMicro = {
    code: "01:220:485",
    title: "Advanced Microeconomic Theory",
    credits: "3",
    catalogPrereqs: "(01:220:320 INTERMEDIATE MICROECONOMIC ANALYSIS and 01:220:321 INTERMEDIATE MACROECONOMIC ANALYSIS and 01:220:322 ECONOMETRICS and 01:640:136 CALCULUS II FOR THE LIFE AND SOCIAL SCIENCES) OR (01:220:320 INTERMEDIATE MICROECONOMIC ANALYSIS and 01:220:321 INTERMEDIATE MACROECONOMIC ANALYSIS and 01:220:322 ECONOMETRICS and 01:640:152 CALCULUS II FOR MATHEMATICAL AND PHYSICAL SCIENCES)",
  };
  tree.groups.fixed.members.push("advancedMicro");

  const result = build({ requirementTrees: [{ id: "economics", tree }] });

  assert.deepEqual(plain(result.prerequisitePathsByCode["01:220:485"]), [
    ["01:220:320", "01:220:321", "01:220:322", "01:640:136"],
    ["01:220:320", "01:220:321", "01:220:322", "01:640:152"],
  ]);
});

test("regeneration drops obsolete generated entries but retains explicit pins", () => {
  const result = build({
    schedule: {
      generated: { code: "01:198:998", title: "Old generated", credits: 3, year: 1, sem: "fall", locked: false, userPinned: false },
      pinned: { code: "01:198:999", title: "Pinned extra", credits: 3, year: 4, sem: "spring", locked: true, userPinned: true },
    },
  });
  assert.equal(result.courses.some((course) => course.code === "01:198:998"), false);
  assert.equal(result.courses.some((course) => course.code === "01:198:999"), true);
  assert.equal(result.lockedPlacements["01:198:999"].sem, "spring");
});

test("saved elective and sequence choices become concrete planner courses", () => {
  const result = build({
    groupSelections: {
      electives: ["electiveA", "electiveB"],
      science: ["physics"],
    },
  });
  const codes = new Set(result.courses.map((course) => course.code));
  assert.ok(codes.has("01:198:314"));
  assert.ok(codes.has("01:198:323"));
  assert.ok(codes.has("01:750:203"));
  assert.ok(codes.has("01:750:204"));
  assert.equal(result.unresolvedRequirements.length, 0);
});

test("distinct Core goal pools remain placeholders until a goal is explicitly chosen", () => {
  const coreTree = {
    roots: ["areas"],
    courses: {
      historyA: { code: "01:510:101", title: "History option A", credits: "3" },
      historyB: { code: "01:510:102", title: "History option B", credits: "3" },
      literatureA: { code: "01:195:101", title: "Literature option A", credits: "3" },
      literatureB: { code: "01:195:102", title: "Literature option B", credits: "3" },
    },
    groups: {
      areas: { id: "areas", name: "Areas of Inquiry", rule: "all", members: [], children: ["humanities"] },
      humanities: {
        id: "humanities",
        name: "Arts and Humanities (2 distinct goals)",
        rule: "distinct",
        count: 2,
        members: ["historyA", "historyB", "literatureA", "literatureB"],
        children: ["history", "literature"],
        parentId: "areas",
      },
      history: { id: "history", name: "Historical Analysis", rule: "all", members: ["historyA", "historyB"], children: [], parentId: "humanities" },
      literature: { id: "literature", name: "Literary Analysis", rule: "all", members: ["literatureA", "literatureB"], children: [], parentId: "humanities" },
    },
  };

  const result = build({ requirementTrees: [], coreTree });
  assert.deepEqual(plain(result.courses), []);
  assert.deepEqual(plain(result.unresolvedRequirements.map((item) => item.requirementGroupId)), [
    "humanities",
    "humanities",
  ]);
  assert.ok(result.unresolvedRequirements.every((item) => item.sourceType === "core"));
  assert.ok(result.unresolvedRequirements.every((item) => item.candidateSelectionContext.sourceType === "core"));
  assert.ok(result.unresolvedRequirements.every((item) => item.candidateSelectionContext.requirementGroupId === "humanities"));
  assert.deepEqual(
    plain(result.unresolvedRequirements[0].candidateSelectionContext.distinctAttributes),
    [],
  );
  assert.deepEqual(
    plain(result.unresolvedRequirements[0].candidateSelectionContext.memberCourseCodes),
    ["01:510:101", "01:510:102", "01:195:101", "01:195:102"]
  );
});

test("Core placeholders retain Core identity when backend groups have a program owner", () => {
  const coreTree = {
    roots: ["writing"],
    courses: {
      writingA: { code: "01:355:101", title: "Writing option A", credits: "3" },
      writingB: { code: "01:355:201", title: "Writing option B", credits: "3" },
    },
    groups: {
      writing: {
        id: "writing",
        name: "College Writing",
        rule: "min",
        count: 1,
        members: ["writingA", "writingB"],
        children: [],
        sourceProgramId: "rutgers-nb-core-curriculum",
      },
    },
  };

  const result = build({ requirementTrees: [], coreTree });
  assert.equal(result.unresolvedRequirements.length, 1);
  assert.equal(result.unresolvedRequirements[0].sourceType, "core");
  assert.equal(result.unresolvedRequirements[0].sourceProgram, "rutgers-nb-core-curriculum");
  assert.equal(result.unresolvedRequirements[0].candidateSelectionContext.sourceType, "core");
});

test("a selected Arts and Humanities child goal resolves its parent slot and every compatible Core requirement", () => {
  const shared = { code: "01:730:104", title: "Introduction to Philosophy - Writing Intensive", credits: "4" };
  const coreTree = {
    roots: ["contemporary", "areas"],
    courses: { shared },
    groups: {
      contemporary: { id: "contemporary", name: "Contemporary Challenges", rule: "all", members: [], children: ["ccd"] },
      ccd: { id: "ccd", name: "Diversities and Social Inequalities [CCD]", rule: "min", count: 1, members: ["shared"], children: [], parentId: "contemporary" },
      areas: { id: "areas", name: "Areas of Inquiry", rule: "all", members: [], children: ["ah"] },
      ah: { id: "ah", name: "Arts and Humanities [AH]", rule: "distinct", count: 2, members: ["shared"], children: ["ahp", "aho"], parentId: "areas" },
      ahp: { id: "ahp", name: "Philosophical and Theoretical Issues [AHp]", rule: "all", members: ["shared"], children: [], parentId: "ah" },
      aho: { id: "aho", name: "Arts and Humanities [AHo]", rule: "all", members: [], children: [], parentId: "ah" },
    },
  };

  const result = build({
    requirementTrees: [],
    coreTree,
    groupSelections: { ahp: ["shared"] },
  });

  assert.deepEqual(plain(result.courses.map((course) => course.code)), ["01:730:104"]);
  assert.equal(result.unresolvedRequirements.some((item) => item.requirementGroupId === "ccd"), false);
  assert.equal(result.unresolvedRequirements.filter((item) => item.requirementGroupId === "ah").length, 1);
  assert.deepEqual(
    plain(result.unresolvedRequirements.find((item) => item.requirementGroupId === "ah")
      .candidateSelectionContext.distinctAttributes),
    ["AHp", "AHo"],
  );
  assert.deepEqual(
    plain(result.planningDecisions.find((item) => item.requirementGroupId === "ah")
      .candidates[0].attributes),
    ["AHp"],
  );
});

test("selector-backed minor decisions retain ownership and remain guideable before candidates load", () => {
  const tree = {
    roots: ["philosophy"],
    courses: {},
    groups: {
      philosophy: {
        id: "philosophy",
        name: "Six Philosophy courses of at least three credits",
        rule: "min",
        count: 6,
        members: [],
        children: [],
        sourceProgramId: "sasnb-philosophy-minor",
        courseSelectors: [{ selector_json: JSON.stringify({ version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["730"], course_number_min: 100, course_number_max: 499, minimum_credits: 3 }) }],
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "selected-programs", tree }] });
  const decision = result.planningDecisions[0];

  assert.equal(decision.sourceProgram, "sasnb-philosophy-minor");
  assert.equal(decision.planningMode, "guided_flexible");
  assert.equal(decision.slotCount, 6);
  assert.equal(decision.courseSelectors.length, 1);
});

test("generic choose labels inherit meaningful parent requirement context", () => {
  const tree = {
    roots: ["business-core"],
    courses: {
      first: { code: "33:136:385", title: "Statistical Methods in Business", credits: "3" },
      second: { code: "33:136:386", title: "Business Operations Analytics", credits: "3" },
    },
    groups: {
      "business-core": { id: "business-core", name: "Business Core", rule: "all", members: [], children: ["choose-one"] },
      "choose-one": { id: "choose-one", name: "Choose 1", rule: "min", count: 1, members: ["first", "second"], children: [], parentId: "business-core" },
    },
  };

  const result = build({ requirementTrees: [{ id: "rbsnb-finance", tree }] });
  assert.equal(result.unresolvedRequirements[0].label, "Business Core option");
});

test("raw off-universe prerequisites stay advisory without silently choosing a requirement option", () => {
  const tree = {
    roots: ["root"],
    courses: {
      statistics: { code: "01:960:285", title: "Business Statistics", credits: "3" },
      calculus: {
        code: "01:640:135",
        title: "Calculus I",
        credits: "4",
        catalogPrereqs: "01:640:025 or 01:640:026",
      },
      methods: {
        code: "33:136:385",
        title: "Statistical Methods in Business",
        credits: "3",
        catalogPrereqs: "01:640:135 and 01:960:285",
      },
      timeSeries: {
        code: "33:136:485",
        title: "Time Series Modeling for Business",
        credits: "3",
        catalogPrereqs: "33:136:385",
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Program requirements",
        rule: "all",
        members: ["statistics", "methods", "timeSeries"],
        children: ["calculusChoice"],
      },
      calculusChoice: {
        id: "calculusChoice",
        name: "Calculus I (choose 1)",
        rule: "min",
        count: 1,
        members: ["calculus"],
        children: [],
        parentId: "root",
        sourceProgramId: "shared-foundational-core",
      },
    },
  };

  const input = build({ requirementTrees: [{ id: "bait", tree }] });
  const calculus = input.courses.find((course) => course.code === "01:640:135");
  assert.equal(calculus, undefined);
  assert.equal(input.enforceablePrerequisitePathsByCode["01:640:135"], undefined);
  assert.deepEqual(plain(input.prerequisitePathsByCode["33:136:385"]), [
    ["01:640:135", "01:960:285"],
  ]);
  assert.equal(input.enforceablePrerequisitePathsByCode["33:136:385"], undefined);
  assert.equal(input.unresolvedRequirements.some((item) => item.requirementGroupId === "calculusChoice"), true);

  const result = planner.generatePlan(input);
  assert.equal(result.status, "complete");
  const ordinal = (entry) => (entry.year - 1) * 2 + (entry.sem === "spring" ? 1 : 0);
  assert.ok(ordinal(result.schedule["33:136:385"]) < ordinal(result.schedule["33:136:485"]));
});

test("a required downstream course promotes one reviewed prerequisite choice without double-counting its placeholder", () => {
  const tree = {
    roots: ["root"],
    courses: {
      dataManagement: {
        code: "33:136:470",
        title: "Business Data Management",
        credits: "3",
        prerequisitePaths: [
          ["33:136:370", "33:136:388"],
          ["33:010:458", "33:136:388"],
        ],
        enforceablePrerequisitePaths: [
          ["33:136:370", "33:136:388"],
          ["33:010:458", "33:136:388"],
        ],
        ruleCoverage: "reviewed",
      },
      programming: {
        code: "33:136:388",
        title: "Foundations of Business Programming",
        credits: "3",
      },
      informationSystems: {
        code: "33:136:370",
        title: "Management Information Systems",
        credits: "3",
      },
      accountingSystems: {
        code: "33:010:458",
        title: "Accounting Information Systems",
        credits: "3",
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Business requirements",
        rule: "all",
        members: ["dataManagement", "programming"],
        children: ["systemsChoice"],
      },
      systemsChoice: {
        id: "systemsChoice",
        name: "Choose one information systems course",
        rule: "min_courses",
        count: 1,
        members: ["informationSystems", "accountingSystems"],
        children: [],
        parentId: "root",
      },
    },
  };

  const result = build({
    requirementTrees: [{ id: "rbsnb-bait", tree }],
  });

  assert.deepEqual(plain(result.courses.map((course) => course.code).sort()), [
    "33:136:370",
    "33:136:388",
    "33:136:470",
  ]);
  assert.deepEqual(plain(result.unresolvedRequirements), []);
});

test("a wishlist alternative fulfills its canonical requirement without scheduling both courses", () => {
  const tree = sampleTree();
  tree.courses.businessComputer = {
    code: "01:198:170",
    title: "Computer Applications for Business",
    credits: "3",
    alternatives: [{ code: "01:198:111" }],
  };
  tree.groups.fixed.members = ["businessComputer"];

  const result = build({
    requirementTrees: [{ id: "selected-programs", tree }],
    wishlistCourses: [{
      code: "01:198:111",
      title: "Introduction to Computer Science",
      credits: "4",
    }],
  });

  assert.deepEqual(plain(result.courses.map((course) => course.code)), ["01:198:111"]);
});

test("nested selector subsets become part of the parent total instead of extra or missing slots", () => {
  const selector = (value) => [{ selector_json: JSON.stringify(value) }];
  const tree = {
    roots: ["philosophyTotal"],
    courses: {},
    groups: {
      philosophyTotal: {
        id: "philosophyTotal",
        name: "Six Philosophy courses of at least three credits.",
        rule: "min",
        count: 6,
        members: [],
        children: ["philosophyUpper"],
        courseSelectors: selector({
          version: 1,
          kind: "subject_level",
          school_codes: ["01"],
          subject_codes: ["730"],
          course_number_min: 100,
          course_number_max: 499,
          minimum_credits: 3,
        }),
      },
      philosophyUpper: {
        id: "philosophyUpper",
        name: "At least three Philosophy courses at the 300 or 400 level.",
        rule: "min",
        count: 3,
        members: [],
        children: [],
        parentId: "philosophyTotal",
        courseSelectors: selector({
          version: 1,
          kind: "subject_level",
          school_codes: ["01"],
          subject_codes: ["730"],
          course_number_min: 300,
          course_number_max: 499,
          minimum_credits: 3,
        }),
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "sasnb-philosophy-minor", tree }] });
  const groupIds = result.unresolvedRequirements.map((item) => item.requirementGroupId);

  assert.equal(result.unresolvedRequirements.length, 6);
  assert.equal(groupIds.filter((id) => id === "philosophyUpper").length, 3);
  assert.equal(groupIds.filter((id) => id === "philosophyTotal").length, 3);
  assert.ok(result.unresolvedRequirements.every((item) => /^Course \d+ of \d+ for /.test(item.label)));
});

test("unresolved elective slots retain the prerequisite paths of their finite candidates", () => {
  const tree = {
    roots: ["root"],
    courses: {
      calculusThree: {
        code: "01:640:251",
        title: "Multivariable Calculus",
        credits: "4",
      },
      differentialEquations: {
        code: "01:640:244",
        title: "Differential Equations for Engineering and Physics",
        credits: "4",
        catalogPrereqs: "01:640:251 MULTIVARIABLE CALCULUS",
      },
      elementaryDifferentialEquations: {
        code: "01:640:252",
        title: "Elementary Differential Equations",
        credits: "3",
        catalogPrereqs: "(01:640:251 MULTIVARIABLE CALCULUS and 01:640:250 INTRO LINEAR ALGEBRA)",
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Mathematics minor",
        rule: "all",
        members: ["calculusThree"],
        children: ["mathElectives"],
      },
      mathElectives: {
        id: "mathElectives",
        name: "Four additional 3-credit Mathematics courses.",
        rule: "min",
        count: 4,
        members: ["differentialEquations", "elementaryDifferentialEquations"],
        children: [],
        parentId: "root",
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "sasnb-mathematics-minor", tree }] });
  const slots = result.unresolvedRequirements.filter((item) => item.requirementGroupId === "mathElectives");

  assert.equal(slots.length, 4);
  assert.ok(slots.every((slot) => slot.prerequisitePaths.some((path) => path.includes("01:640:251"))));
});

test("prerequisite promotion prefers a path already required by the plan", () => {
  const tree = {
    roots: ["root"],
    courses: {
      timeSeries: {
        code: "33:136:485",
        title: "Time Series Modeling for Business",
        credits: "3",
        catalogPrereqs: "(01:198:111 INTRO COMPUTER SCI and 01:960:285 INTRO STAT FOR BUS) OR (33:623:385) OR (33:136:385 STATISTICAL METHODS IN BUSINESS)",
      },
      statisticalMethods: {
        code: "33:136:385",
        title: "Statistical Methods in Business",
        credits: "3",
      },
      introComputerScience: {
        code: "01:198:111",
        title: "Introduction to Computer Science",
        credits: "4",
      },
      businessStatistics: {
        code: "01:960:285",
        title: "Introductory Statistics for Business",
        credits: "3",
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Program requirements",
        rule: "all",
        members: ["timeSeries", "statisticalMethods"],
        children: ["coreOptions"],
      },
      coreOptions: {
        id: "coreOptions",
        name: "Core options",
        rule: "min",
        count: 1,
        members: ["introComputerScience", "businessStatistics"],
        children: [],
        parentId: "root",
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "selected-programs", tree }] });
  const codes = result.courses.map((course) => course.code).sort();

  assert.deepEqual(plain(codes), ["33:136:385", "33:136:485"]);
  assert.deepEqual(plain(result.prerequisitePathsByCode["33:136:485"]), [
    ["01:198:111", "01:960:285"],
    ["33:623:385"],
    ["33:136:385"],
  ]);
});

test("raw prerequisite leaves outside reviewed plan data stay advisory during promotion", () => {
  const tree = {
    roots: ["root"],
    courses: {
      downstream: {
        code: "33:136:485",
        title: "Time Series Modeling for Business",
        credits: "3",
        catalogPrereqs: "01:640:112 or 33:136:385",
      },
      blockedPreparation: {
        code: "01:640:112",
        title: "Precalculus Part II",
        credits: "2",
        catalogPrereqs: "01:640:111",
      },
      viablePreparation: {
        code: "33:136:385",
        title: "Statistical Methods in Business",
        credits: "3",
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Program requirements",
        rule: "all",
        members: ["downstream"],
        children: ["preparation"],
      },
      preparation: {
        id: "preparation",
        name: "Preparation",
        rule: "min",
        count: 1,
        members: ["blockedPreparation", "viablePreparation"],
        children: [],
        parentId: "root",
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "bait", tree }] });
  const codes = new Set(result.courses.map((course) => course.code));

  assert.equal(codes.has("01:640:112"), false);
  assert.equal(codes.has("33:136:385"), false);
  assert.equal(result.enforceablePrerequisitePathsByCode["01:640:112"], undefined);
  assert.equal(result.unresolvedRequirements.some((item) => item.requirementGroupId === "preparation"), true);
});

test("an unselected Core alternative cannot become required through a catalog-parsed prerequisite", () => {
  const tree = {
    roots: ["root"],
    courses: {
      calculusForMath: {
        code: "01:640:151",
        title: "Calculus I for Mathematical and Physical Sciences",
        credits: "4",
      },
      calculusForBusiness: {
        code: "01:640:135",
        title: "Calculus I for the Life and Social Sciences",
        credits: "4",
      },
      statistics: {
        code: "01:960:285",
        title: "Introductory Statistics for Business",
        credits: "3",
      },
      methods: {
        code: "33:136:385",
        title: "Statistical Methods in Business",
        credits: "3",
        prerequisitePaths: [["01:640:135", "01:960:285"]],
        enforceablePrerequisitePaths: [["01:640:135", "01:960:285"]],
        ruleCoverage: "catalog_parsed",
      },
    },
    groups: {
      root: {
        id: "root",
        name: "Combined requirements",
        rule: "all",
        members: ["calculusForMath", "statistics", "methods"],
        children: ["businessCalculusChoice"],
      },
      businessCalculusChoice: {
        id: "businessCalculusChoice",
        name: "Calculus I (choose 1)",
        rule: "min",
        count: 1,
        members: ["calculusForBusiness", "calculusForMath"],
        children: [],
        parentId: "root",
      },
    },
  };

  const result = build({ requirementTrees: [{ id: "combined", tree }] });

  assert.equal(result.courses.some((course) => course.code === "01:640:135"), false);
  assert.equal(result.unresolvedRequirements.some((item) => item.requirementGroupId === "businessCalculusChoice"), false);
  assert.equal(result.enforceablePrerequisitePathsByCode["33:136:385"], undefined);
  assert.deepEqual(plain(result.prerequisitePathsByCode["33:136:385"]), [
    ["01:640:135", "01:960:285"],
  ]);
});

test("approved catalog choices enforce prerequisite paths only when every course was selected", () => {
  const result = plannerInput().applyApprovedCourseSet({
    courses: [
      {
        code: "01:640:151",
        title: "Calculus I for Mathematical and Physical Sciences",
        credits: 4,
        prerequisitePaths: [["01:640:112"]],
        enforceablePrerequisitePaths: [["01:640:112"]],
        ruleCoverage: "catalog_parsed",
      },
    ],
    completedCourseCodes: [],
    unresolvedRequirements: [{
      sourceType: "core",
      sourceProgram: "core",
      requirementGroupId: "science",
    }],
    prerequisitePathsByCode: { "01:640:151": [["01:640:112"]] },
    enforceablePrerequisitePathsByCode: { "01:640:151": [["01:640:112"]] },
  }, {
    status: "complete",
    selectedCourses: [
      {
        code: "01:119:115",
        title: "General Biology I",
        credits: 4,
        prerequisitePaths: [],
        enforceablePrerequisitePaths: [],
        ruleCoverage: "catalog_parsed",
        prerequisiteOnly: true,
      },
      {
        code: "01:119:116",
        title: "General Biology II",
        credits: 4,
        prerequisitePaths: [["01:119:115"]],
        enforceablePrerequisitePaths: [["01:119:115"]],
        ruleCoverage: "catalog_parsed",
        coverageRequirementIds: ["core:core:science"],
      },
    ],
  });

  assert.equal(result.enforceablePrerequisitePathsByCode["01:640:151"], undefined);
  assert.deepEqual(plain(result.enforceablePrerequisitePathsByCode["01:119:116"]), [["01:119:115"]]);
});
