import assert from "node:assert/strict";
import test from "node:test";
import {
  programHasCompleteRequirementEvidence,
  programRequirementStructureComplete,
  publishedCatalogPrograms,
} from "../src/programs.js";

test("publication rejects empty or candidate-free requirement trees", () => {
  assert.equal(programRequirementStructureComplete({ groups: [], courses: [], selectors: [] }), false);
  assert.equal(programRequirementStructureComplete({
    groups: [{ id: "root", parent_group_id: null }], courses: [], selectors: [],
  }), false);
  assert.equal(programRequirementStructureComplete({
    groups: [{ id: "root", parent_group_id: null }],
    courses: [{ group_id: "root", course_code: "01:198:111" }], selectors: [],
  }), true);
  assert.equal(programRequirementStructureComplete({
    groups: [{ id: "root", parent_group_id: null }], courses: [],
    selectors: [{ group_id: "root" }],
  }), true);
});

test("publication evidence checks receive course rows rather than selector rows", async () => {
  const group = { id: "finance", parent_group_id: null };
  const course = { group_id: "finance", course_code: "33:390:440" };
  const evidence = [
    {
      entity_key: "group:finance", entity_type: "group", group_id: "finance", course_code: null,
      review_status: "reviewed", source_url: "https://catalogs.rutgers.edu/finance",
      source_title: "Finance", accessed_at: 1, reviewer_note: "Confirmed group",
    },
    {
      entity_key: "course:finance:33:390:440", entity_type: "course", group_id: "finance", course_code: "33:390:440",
      review_status: "reviewed", source_url: "https://catalogs.rutgers.edu/finance",
      source_title: "Finance", accessed_at: 1, reviewer_note: "Confirmed course",
    },
  ];
  const resultSets = [
    { results: [group] },
    { results: [] },
    { results: [course] },
    { results: evidence },
  ];
  const env = {
    DB: {
      prepare: () => ({ bind() { return this; } }),
      batch: async () => resultSets,
    },
  };

  assert.equal(await programHasCompleteRequirementEvidence(env, { id: "finance", requirement_evidence_required: 1 }), true);
});

test("a reviewed program replaces its catalog-listed twin without hiding an unreviewed catalog program", () => {
  const programs = publishedCatalogPrograms([
    {
      id: "catalog-sasnb-economics-major",
      name: "Economics",
      school_slug: "sasnb",
      program_slug: "economics",
      type: "major",
      degree_type: "BA",
      review_status: "catalog_listed",
    },
    {
      id: "catalog-sasnb-african-area-studies-minor",
      name: "African Area Studies",
      school_slug: "sasnb",
      program_slug: "african-area-studies",
      type: "minor",
      degree_type: null,
      review_status: "catalog_listed",
    },
  ], [{
    id: "sasnb-economics-major",
    name: "Economics",
    school_slug: "sasnb",
    program_slug: "economics",
    type: "major",
    degree_type: "B.A.",
    review_status: "reviewed",
    requirement_evidence_required: 1,
  }]);

  assert.deepEqual(programs.map((program) => ({ id: program.id, coverage_status: program.coverage_status, requirements_available: program.requirements_available, catalog_program_id: program.catalog_program_id || null })), [
    { id: "catalog-sasnb-african-area-studies-minor", coverage_status: "catalog_listed", requirements_available: false, catalog_program_id: null },
    { id: "sasnb-economics-major", coverage_status: "reviewed", requirements_available: true, catalog_program_id: "catalog-sasnb-economics-major" },
  ]);
});
