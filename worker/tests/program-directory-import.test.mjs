import assert from "node:assert/strict";
import test from "node:test";
import { importProgramDirectory, parseProgramDirectory } from "../src/program-directory-import.js";

const DIRECTORY_SOURCE = {
  id: "sasnb-official-directory",
  school_slug: "sasnb",
  directory_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/list-of-majors-and-minors",
  profile_path: "/majors-and-core-curriculum/major/major-minor-details/",
  catalog_year: "Official SAS directory",
  source_title: "SAS Majors and Minors",
  owner_labels: ["SAS", "SAS/ SC&I"],
  program_id_overrides: {
    "criminal-justice:major": "sasnb-criminal-justice-major",
  },
};

test("an official program directory becomes normalized catalog-listed program records", () => {
  const html = `
    <tr><td><a href="/majors-and-core-curriculum/major/major-minor-details/economics" title="Economics (Major, Minor) | BA"><h2>Economics (Major, Minor) | BA</h2></a></td><td data-title="School"><span class="detail_data">SAS</span></td></tr>
    <tr><td><a href="/majors-and-core-curriculum/major/major-minor-details/computer-science-b-s" title="Computer Science (Major) | BS"><h2>Computer Science (Major) | BS</h2></a></td><td data-title="School"><span class="detail_data">SAS/ SC&amp;I</span></td></tr>
    <tr><td><a href="/majors-and-core-curriculum/major/major-minor-details/history" title="History (Major/ Minor) BA"><h2>History (Major/ Minor) BA</h2></a></td><td data-title="School"><span class="detail_data">SAS</span></td></tr>
    <tr><td><a href="/majors-and-core-curriculum/major/major-minor-details/criminal-justice" title="Criminal Justice (Major) | BA"><h2>Criminal Justice (Major) | BA</h2></a></td><td data-title="School"><span class="detail_data">SAS</span></td></tr>
    <tr><td><a href="/majors-and-core-curriculum/major/major-minor-details/business-administration" title="Business Administration (Minor)"><h2>Business Administration (Minor)</h2></a></td><td data-title="School"><span class="detail_data">RBS</span></td></tr>
  `;

  assert.deepEqual(parseProgramDirectory(html, DIRECTORY_SOURCE), [
    {
      id: "sasnb-catalog-economics-major",
      name: "Economics",
      school_slug: "sasnb",
      program_slug: "economics",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-catalog-economics",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "sasnb-catalog-economics-minor",
      name: "Economics",
      school_slug: "sasnb",
      program_slug: "economics",
      type: "minor",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-catalog-economics",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "sasnb-catalog-computer-science-b-s-major",
      name: "Computer Science",
      school_slug: "sasnb",
      program_slug: "computer-science-b-s",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BS",
      program_family_id: "sasnb-catalog-computer-science-b-s",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/computer-science-b-s",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "sasnb-catalog-history-major",
      name: "History",
      school_slug: "sasnb",
      program_slug: "history",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-catalog-history",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/history",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "sasnb-catalog-history-minor",
      name: "History",
      school_slug: "sasnb",
      program_slug: "history",
      type: "minor",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-catalog-history",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/history",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "sasnb-criminal-justice-major",
      name: "Criminal Justice",
      school_slug: "sasnb",
      program_slug: "criminal-justice",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-catalog-criminal-justice",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/criminal-justice",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
  ]);
});

test("a directory importer saves only a non-empty parsed official directory", async () => {
  const saved = [];
  const result = await importProgramDirectory({
    source: DIRECTORY_SOURCE,
    fetchHtml: async () => '<tr><td><a href="/majors-and-core-curriculum/major/major-minor-details/biology" title="Biology (Minor)">Biology (Minor)</a></td><td data-title="School"><span class="detail_data">SAS</span></td></tr>',
    saveEntries: async (entries) => saved.push(...entries),
  });

  assert.equal(result.programs_imported, 1);
  assert.deepEqual(saved.map((entry) => entry.id), ["sasnb-catalog-biology-minor"]);
  await assert.rejects(
    importProgramDirectory({
      source: DIRECTORY_SOURCE,
      fetchHtml: async () => "<html>No programs here</html>",
      saveEntries: async () => assert.fail("empty imports must not write"),
    }),
    /parsed zero programs/
  );
});
