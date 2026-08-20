import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL(
  "../../packages/requirements/src/requirement-tree-builder.js",
  import.meta.url,
);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

const builder = () => {
  assert.ok(
    context.globalThis.ScheduleRURequirementTreeBuilder,
    "requirement-tree-builder.js must expose ScheduleRURequirementTreeBuilder",
  );
  return context.globalThis.ScheduleRURequirementTreeBuilder;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("builder normalizes nested groups and inherits every display owner", () => {
  const requirements = [{
    id: "root",
    name: "Business Core",
    rule: "min_courses",
    count: 2,
    program_id: "finance",
    sourceProgramIds: ["finance", "accounting"],
    display_family: "  rbs-core  ",
    display_priority: "20",
    allocation: "exclusive",
    course_selectors: [{ selector_json: '{"subject":"390"}' }],
    courses: [],
    children: [{
      id: "child",
      name: "Choose one",
      rule: "one_of",
      count: 1,
      program_id: "finance",
      courses: [],
      children: [],
    }],
  }];

  const tree = plain(builder().build(requirements));

  assert.deepEqual(tree.roots, ["root"]);
  assert.equal(tree.groups.root.rule, "min");
  assert.equal(tree.groups.root.display_family, "rbs-core");
  assert.equal(tree.groups.root.display_priority, 20);
  assert.deepEqual(tree.groups.root.children, ["child"]);
  assert.equal(tree.groups.child.parentId, "root");
  assert.equal(tree.groups.child.rule, "one_of");
  assert.deepEqual(tree.groups.child.sourceProgramIds, ["finance", "accounting"]);
});

test("builder merges repeated course metadata and deduplicates reviewed alternatives", () => {
  const requirements = [{
    id: "root",
    name: "Required",
    rule: "all",
    courses: [{
      course_code: "01:198:111",
      source_title: "INTRO COMPUTER SCI",
      source_credits: "4",
      catalog_title: "<em>Introduction</em> &amp; Computer Science",
      catalog_description: " Learn   the basics. ",
      note: "First note",
      eligibility: { review: { review_status: "reviewed" }, conditions: [] },
      alternatives: [{
        equivalent_course_code: "01:198:110",
        source_title: "Alternative A",
        catalog_prereqs: "01:198:109",
        eligibility: {
          review: null,
          conditions: [],
          credit_exclusions: [{ policy_key: "intro-computing-credit" }],
        },
      }],
    }],
    children: [{
      id: "nested",
      name: "Nested",
      rule: "all",
      courses: [{
        course_code: "01:198:111",
        source_title: "Updated source title",
        note: "Second note",
        alternatives: [{
          equivalent_course_code: "01:198:110",
          catalog_title: "Approved Alternative",
          catalog_credits: "4",
        }],
      }],
      children: [],
    }],
  }];
  const before = JSON.stringify(requirements);

  const tree = plain(builder().build(requirements));
  const course = tree.courses["01198111"];

  assert.equal(JSON.stringify(requirements), before);
  assert.equal(course.title, "Updated source title");
  assert.equal(course.description, "Learn the basics.");
  assert.deepEqual(course.eligibility, {
    review: { review_status: "reviewed" },
    conditions: [],
  });
  assert.deepEqual(course.requirementNotes, ["First note", "Second note"]);
  assert.deepEqual(course.alternatives, [{
    code: "01:198:110",
    title: "Approved Alternative",
    credits: "4",
    note: "",
    sourceLabel: "",
    catalogPrereqs: "01:198:109",
    eligibility: {
      review: null,
      conditions: [],
      credit_exclusions: [{ policy_key: "intro-computing-credit" }],
    },
  }]);
  assert.deepEqual(tree.groups.root.members, ["01198111"]);
  assert.deepEqual(tree.groups.nested.members, ["01198111"]);
});

test("builder derives only unambiguous prerequisite course IDs that exist in the tree", () => {
  const requirements = [{
    id: "root",
    name: "Required",
    rule: "all",
    courses: [
      { course_code: "01:198:111", source_title: "Intro" },
      { course_code: "01:198:112", source_title: "Data Structures", note: "Pre-reqs: 01:198:111" },
      { course_code: "01:198:205", source_title: "Ambiguous", note: "Pre-reqs: 01:198:111 or 01:640:151" },
      { course_code: "01:198:206", source_title: "Unknown", note: "Pre-reqs: 01:640:151" },
    ],
    children: [],
  }];

  const tree = plain(builder().build(requirements));

  assert.deepEqual(tree.courses["01198112"].prereqs, ["01198111"]);
  assert.deepEqual(tree.courses["01198205"].prereqs, []);
  assert.deepEqual(tree.courses["01198206"].prereqs, []);
  assert.equal(builder().requirementCourseId("01:198:111"), "01198111");
});
