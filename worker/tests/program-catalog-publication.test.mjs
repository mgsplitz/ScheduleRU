import assert from "node:assert/strict";
import test from "node:test";
import { publishedCatalogPrograms } from "../src/programs.js";

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

  assert.deepEqual(programs.map((program) => ({ id: program.id, coverage_status: program.coverage_status, requirements_available: program.requirements_available })), [
    { id: "catalog-sasnb-african-area-studies-minor", coverage_status: "catalog_listed", requirements_available: false },
    { id: "sasnb-economics-major", coverage_status: "reviewed", requirements_available: true },
  ]);
});
