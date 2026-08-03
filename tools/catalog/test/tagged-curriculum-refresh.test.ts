import assert from "node:assert/strict";
import test from "node:test";

import type { ProgramDefinition } from "@scheduleru/catalog";
import {
  buildTaggedCurriculumDraft,
} from "../src/tagged-curriculum-refresh.ts";

function reviewedDefinition(): ProgramDefinition {
  return {
    contract_version: 1,
    program: {
      id: "rutgers-nb-example-core",
      name: "Example Core Curriculum",
      school_slug: "rutgers-nb",
      program_slug: "example-core",
      type: "core_curriculum",
      catalog_year: "2026-2027",
      academic_program_code: null,
      degree_type: null,
      program_family_id: null,
      source_url: "https://example.rutgers.edu/core",
      review_status: "reviewed",
      requirement_evidence_required: false,
    },
    sources: [{
      id: "official-core",
      url: "https://example.rutgers.edu/core",
      title: "Official Core",
      catalog_year: "2026-2027",
      scope: "program_requirements",
      accessed_at: 100,
      note: "Official source.",
    }],
    requirement_groups: [
      {
        id: "root",
        parent_group_id: null,
        name: "Cognitive Skills",
        rule: "all",
        count: null,
        sort_order: 0,
        display_family: null,
        display_priority: 0,
        courses: [],
        selectors: [],
        conditions: [],
        evidence: {
          source_id: "official-core",
          reviewer_note: "Reviewed hierarchy.",
          review_status: "reviewed",
        },
      },
      {
        id: "quantitative",
        parent_group_id: "root",
        name: "Quantitative Skills",
        rule: "all",
        count: null,
        sort_order: 1,
        display_family: null,
        display_priority: 0,
        courses: [
          { code: "01:198:100", title: "OLD SHARED", credits: 3, note: null },
          { code: "01:640:100", title: "OLD QQ", credits: 3, note: null },
        ],
        selectors: [],
        conditions: [],
      },
      {
        id: "qq-group",
        parent_group_id: "quantitative",
        name: "Quantitative Information [QQ]",
        rule: "min_courses",
        count: 1,
        sort_order: 2,
        display_family: null,
        display_priority: 0,
        courses: [
          { code: "01:198:100", title: "OLD SHARED", credits: 3, note: null },
          { code: "01:640:100", title: "OLD QQ", credits: 3, note: null },
        ],
        selectors: [{
          key: "qq-selector",
          source_id: "official-core",
          source_label: "Official Core",
          review_status: "reviewed",
          reviewed_at: 100,
          selector: {
            version: 1,
            kind: "course_codes",
            include_course_codes: ["01:640:100"],
          },
        }],
        conditions: [{
          type: "advising_note",
          value: { applies: true },
          note: null,
          source_id: "official-core",
          review_status: "reviewed",
        }],
      },
      {
        id: "qr-group",
        parent_group_id: "quantitative",
        name: "Formal Reasoning [QR]",
        rule: "min_courses",
        count: 1,
        sort_order: 3,
        display_family: null,
        display_priority: 0,
        courses: [
          { code: "01:198:100", title: "OLD SHARED", credits: 3, note: null },
        ],
        selectors: [],
        conditions: [],
      },
    ],
    eligibility_rules: [{
      key: "example-rule",
      condition_type: "note",
      condition_value: { applies: true },
      decision: "requires_approval",
      note: "Example.",
      source_id: "official-core",
      review_status: "reviewed",
      verified_at: 100,
    }],
  };
}

const REFRESHED_COURSES = [
  {
    code: "01:198:111",
    title: "INTRO COMPUTER SCI",
    credits: 4,
    tags: ["QQ", "QR"],
  },
  {
    code: "01:640:151",
    title: "CALCULUS I",
    credits: 4,
    tags: ["QQ"],
  },
];

test("tagged curriculum refresh replaces source-derived lists without changing structure", () => {
  const reviewed = reviewedDefinition();
  const { definition, report } = buildTaggedCurriculumDraft(
    reviewed,
    REFRESHED_COURSES,
    500,
  );

  assert.equal(definition.program.review_status, "unreviewed");
  const source = definition.sources[0];
  assert.ok(source);
  assert.equal(source.accessed_at, 500);
  assert.deepEqual(
    definition.requirement_groups.map((group) => ({
      id: group.id,
      parent: group.parent_group_id,
      name: group.name,
      rule: group.rule,
      count: group.count,
      sort: group.sort_order,
    })),
    reviewed.requirement_groups.map((group) => ({
      id: group.id,
      parent: group.parent_group_id,
      name: group.name,
      rule: group.rule,
      count: group.count,
      sort: group.sort_order,
    })),
  );
  const root = definition.requirement_groups.find(({ id }) => id === "root");
  const quantitative = definition.requirement_groups.find(
    ({ id }) => id === "quantitative",
  );
  const qq = definition.requirement_groups.find(({ id }) => id === "qq-group");
  const qr = definition.requirement_groups.find(({ id }) => id === "qr-group");
  const eligibility = definition.eligibility_rules[0];
  assert.ok(root && quantitative && qq && qr && eligibility);
  assert.deepEqual(root.courses, []);
  assert.deepEqual(
    quantitative.courses.map(({ code }) => code),
    ["01:198:111", "01:640:151"],
  );
  assert.deepEqual(
    qq.courses.map(({ code }) => code),
    ["01:198:111", "01:640:151"],
  );
  assert.deepEqual(qr.courses.map(({ code }) => code), ["01:198:111"]);
  assert.equal(root.evidence?.review_status, "unreviewed");
  assert.equal(qq.selectors[0]?.review_status, "unreviewed");
  assert.equal(qq.conditions[0]?.review_status, "unreviewed");
  assert.equal(eligibility.review_status, "unreviewed");
  assert.deepEqual(report, {
    program_id: "rutgers-nb-example-core",
    source_url: "https://example.rutgers.edu/core",
    accessed_at: 500,
    previous_assignment_count: 5,
    generated_assignment_count: 5,
    added: [
      { group_id: "qq-group", course_code: "01:198:111" },
      { group_id: "qq-group", course_code: "01:640:151" },
      { group_id: "qr-group", course_code: "01:198:111" },
      { group_id: "quantitative", course_code: "01:198:111" },
      { group_id: "quantitative", course_code: "01:640:151" },
    ],
    removed: [
      { group_id: "qq-group", course_code: "01:198:100" },
      { group_id: "qq-group", course_code: "01:640:100" },
      { group_id: "qr-group", course_code: "01:198:100" },
      { group_id: "quantitative", course_code: "01:198:100" },
      { group_id: "quantitative", course_code: "01:640:100" },
    ],
  });
});

test("tagged curriculum refresh fails closed on unmapped or incomplete tags", () => {
  assert.throws(
    () => buildTaggedCurriculumDraft(
      reviewedDefinition(),
      [...REFRESHED_COURSES, {
        code: "01:123:101",
        title: "UNKNOWN",
        credits: 3,
        tags: ["ZZ"],
      }],
      500,
    ),
    /source tag ZZ has no matching tagged leaf group/,
  );
  assert.throws(
    () => buildTaggedCurriculumDraft(
      reviewedDefinition(),
      REFRESHED_COURSES.filter(({ tags }) => !tags.includes("QR")),
      500,
    ),
    /tagged group qr-group received no source courses/,
  );
});

test("tagged curriculum refresh rejects ambiguous structures and non-Core definitions", () => {
  const duplicated = reviewedDefinition();
  const qq = duplicated.requirement_groups.find(({ id }) => id === "qq-group");
  assert.ok(qq);
  duplicated.requirement_groups.push({
    ...structuredClone(qq),
    id: "qq-duplicate",
  });
  assert.throws(
    () => buildTaggedCurriculumDraft(duplicated, REFRESHED_COURSES, 500),
    /tag QQ is assigned to multiple leaf groups/,
  );

  const minor = reviewedDefinition();
  minor.program.type = "minor";
  assert.throws(
    () => buildTaggedCurriculumDraft(minor, REFRESHED_COURSES, 500),
    /must be a core_curriculum definition/,
  );
});
