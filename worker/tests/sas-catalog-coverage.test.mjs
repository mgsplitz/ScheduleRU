import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { publishedSasCatalogPrograms } from "../src/programs.js";

const manifestUrl = new URL("../src/sas-catalog-manifest.js", import.meta.url);
const workerUrl = new URL("../src/programs.js", import.meta.url);
const pageUrl = new URL("../../index.html", import.meta.url);

test("the official SAS catalog manifest exposes every catalog major and minor as a sourced selectable path", async () => {
  assert.equal(existsSync(manifestUrl), true, "SAS catalog coverage requires a maintained manifest");
  const { SAS_CATALOG_PROGRAMS } = await import(manifestUrl.href);

  assert.equal(SAS_CATALOG_PROGRAMS.length, 246);
  assert.equal(SAS_CATALOG_PROGRAMS.filter((program) => program.type === "major").length, 110);
  assert.equal(SAS_CATALOG_PROGRAMS.filter((program) => program.type === "minor").length, 136);
  assert.equal(new Set(SAS_CATALOG_PROGRAMS.map((program) => program.id)).size, 246);

  for (const program of SAS_CATALOG_PROGRAMS) {
    assert.equal(program.school_slug, "sasnb");
    assert.equal(program.coverage_status, "catalog_listed");
    assert.equal(program.requirements_available, false);
    assert.match(program.source_url, /^https:\/\/sasundergrad\.rutgers\.edu\/majors-and-core-curriculum\/major\/major-minor-details\//);
  }

  const historyMajor = SAS_CATALOG_PROGRAMS.find((program) => program.program_slug === "history" && program.type === "major");
  assert.equal(historyMajor?.name, "History");
  assert.equal(historyMajor?.degree_type, "BA");
});

test("catalog-listed SAS paths stay selectable while only reviewed paths claim requirement trees", async () => {
  const worker = await readFile(workerUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");

  assert.match(worker, /SAS_CATALOG_PROGRAMS/);
  assert.match(worker, /publishedSasCatalogPrograms/);
  assert.match(worker, /catalog_listed_program_ids/);
  assert.match(page, /Catalog-listed programs are selectable/);
  assert.match(page, /requirements_available/);
});

test("a reviewed program replaces, rather than duplicates, its catalog coverage record", () => {
  const programs = publishedSasCatalogPrograms([{
    id: "sasnb-economics-major",
    name: "Economics",
    school_slug: "sasnb",
    program_slug: "economics",
    type: "major",
    degree_type: "B.A.",
    program_family_id: "sasnb-economics-220",
    requirement_evidence_required: 1,
  }]);

  assert.equal(programs.length, 246);
  assert.equal(programs.find((program) => program.id === "sasnb-catalog-economics-major"), undefined);
  assert.deepEqual(programs.find((program) => program.id === "sasnb-economics-major"), {
    id: "sasnb-economics-major",
    name: "Economics",
    school_slug: "sasnb",
    program_slug: "economics",
    type: "major",
    degree_type: "B.A.",
    program_family_id: "sasnb-economics-220",
    requirement_evidence_required: 1,
    coverage_status: "reviewed",
    requirements_available: true,
    requirements_notice: null,
  });
});
