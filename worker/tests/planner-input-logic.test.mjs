import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {} };
const eligibilityUrl = new URL("../../eligibility-logic.js", import.meta.url);
vm.runInNewContext(fs.readFileSync(eligibilityUrl, "utf8"), context);
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
