import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {} };
const eligibilityUrl = new URL("../../eligibility-logic.js", import.meta.url);
vm.runInNewContext(fs.readFileSync(eligibilityUrl, "utf8"), context);
const academicCreditUrl = new URL("../../academic-credit-logic.js", import.meta.url);
vm.runInNewContext(fs.readFileSync(academicCreditUrl, "utf8"), context);
const moduleUrl = new URL("../../planner-input-logic.js", import.meta.url);
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
const logic = context.globalThis.ScheduleRUPlannerInput;
const plannerInput = () => {
  assert.ok(logic, "ScheduleRUPlannerInput must be exposed on globalThis");
  return logic;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

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

test("a planned approved alternative is preserved while its canonical requirement is suppressed", () => {
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
        locked: false,
        userPinned: false,
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
});

test("a required downstream course promotes one reviewed prerequisite choice without double-counting its placeholder", () => {
  const tree = {
    roots: ["root"],
    courses: {
      dataManagement: {
        code: "33:136:470",
        title: "Business Data Management",
        credits: "3",
        catalogPrereqs: "((33:136:370 MANAGEMENT INFORMATION SYSTEMS or 33:010:458 ACCTNG INFORM SYSTS) and (33:136:388 FOUNDATIONS OF BUSINESS PROGRAMMING))",
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
