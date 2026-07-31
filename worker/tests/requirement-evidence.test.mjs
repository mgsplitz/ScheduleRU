import assert from "node:assert/strict";
import test from "node:test";
import {
  missingRequirementEvidence,
  requirementEvidenceComplete,
} from "../src/requirement-evidence.js";

const GROUP_ID = "sasnb-ppe-philosophy";
const COURSE_CODE = "01:730:107";

function groupEvidence(groupId = GROUP_ID, overrides = {}) {
  return {
    entity_key: `group:${groupId}`,
    entity_type: "group",
    group_id: groupId,
    course_code: null,
    source_url: "https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics",
    source_title: "Philosophy, Politics, and Economics Minor",
    source_catalog_year: null,
    accessed_at: 1_721_356_800,
    reviewer_note: "Current department page; no catalog-year boundary stated.",
    review_status: "reviewed",
    ...overrides,
  };
}

function courseEvidence(groupId = GROUP_ID, courseCode = COURSE_CODE, overrides = {}) {
  return {
    entity_key: `course:${groupId}:${courseCode}`,
    entity_type: "course",
    group_id: groupId,
    course_code: courseCode,
    source_url: "https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics",
    source_title: "Philosophy, Politics, and Economics Minor",
    source_catalog_year: null,
    accessed_at: 1_721_356_800,
    reviewer_note: "Current department page; no catalog-year boundary stated.",
    review_status: "reviewed",
    ...overrides,
  };
}

const manifest = {
  groups: [{ id: GROUP_ID }],
  courses: [{ group_id: GROUP_ID, course_code: COURSE_CODE }],
};

test("legacy programs do not require requirement evidence", () => {
  assert.equal(requirementEvidenceComplete({ required: false }), true);
});

test("an opt-in program requires reviewed evidence for every group and course", () => {
  assert.equal(requirementEvidenceComplete({
    required: true,
    ...manifest,
    evidence: [groupEvidence(GROUP_ID)],
  }), false);
});

test("an opt-in program accepts exactly one valid reviewed HTTPS row per requirement", () => {
  assert.equal(requirementEvidenceComplete({
    required: true,
    ...manifest,
    evidence: [groupEvidence(), courseEvidence()],
  }), true);
  assert.deepEqual(missingRequirementEvidence({
    ...manifest,
    evidence: [groupEvidence(), courseEvidence()],
  }), []);
});

test("malformed, unreviewed, and mismatched evidence fails closed", () => {
  const invalidRows = [
    groupEvidence(GROUP_ID, { source_title: "   " }),
    groupEvidence(GROUP_ID, { reviewer_note: "" }),
    groupEvidence(GROUP_ID, { accessed_at: null }),
    groupEvidence(GROUP_ID, { source_url: "http://philosophy.rutgers.edu/ppe" }),
    groupEvidence(GROUP_ID, { review_status: "needs_fix" }),
    groupEvidence(GROUP_ID, { entity_type: "course" }),
    groupEvidence(GROUP_ID, { entity_key: "group:another-group" }),
    courseEvidence(GROUP_ID, COURSE_CODE, { group_id: "another-group" }),
    courseEvidence(GROUP_ID, COURSE_CODE, { course_code: "01:730:106" }),
  ];

  for (const evidenceRow of invalidRows) {
    assert.equal(requirementEvidenceComplete({
      required: true,
      ...manifest,
      evidence: [evidenceRow],
    }), false);
  }
});

test("duplicate evidence rows do not satisfy the exact-one evidence contract", () => {
  assert.equal(requirementEvidenceComplete({
    required: true,
    groups: [{ id: GROUP_ID }],
    courses: [],
    evidence: [groupEvidence(), groupEvidence()],
  }), false);
});
