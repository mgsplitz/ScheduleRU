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
};

test("an official program directory becomes normalized catalog-listed program records", () => {
  const html = `
    <a href="/majors-and-core-curriculum/major/major-minor-details/economics" title="Economics (Major, Minor) | BA"><h2>Economics (Major, Minor) | BA</h2></a>
    <a href="/majors-and-core-curriculum/major/major-minor-details/computer-science-b-s" title="Computer Science (Major) | BS"><h2>Computer Science (Major) | BS</h2></a>
    <a href="/majors-and-core-curriculum/major/major-minor-details/history" title="History (Major/ Minor) BA"><h2>History (Major/ Minor) BA</h2></a>
  `;

  assert.deepEqual(parseProgramDirectory(html, DIRECTORY_SOURCE), [
    {
      id: "catalog-sasnb-economics-major",
      name: "Economics",
      school_slug: "sasnb",
      program_slug: "economics",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-economics",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "catalog-sasnb-economics-minor",
      name: "Economics",
      school_slug: "sasnb",
      program_slug: "economics",
      type: "minor",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-economics",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "catalog-sasnb-computer-science-b-s-major",
      name: "Computer Science",
      school_slug: "sasnb",
      program_slug: "computer-science-b-s",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BS",
      program_family_id: "sasnb-computer-science-b-s",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/computer-science-b-s",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "catalog-sasnb-history-major",
      name: "History",
      school_slug: "sasnb",
      program_slug: "history",
      type: "major",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-history",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/history",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
    {
      id: "catalog-sasnb-history-minor",
      name: "History",
      school_slug: "sasnb",
      program_slug: "history",
      type: "minor",
      catalog_year: "Official SAS directory",
      degree_type: "BA",
      program_family_id: "sasnb-history",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/history",
      review_status: "catalog_listed",
      catalog_source_id: "sasnb-official-directory",
    },
  ]);
});

test("a directory importer saves only a non-empty parsed official directory", async () => {
  const saved = [];
  const result = await importProgramDirectory({
    source: DIRECTORY_SOURCE,
    fetchHtml: async () => '<a href="/majors-and-core-curriculum/major/major-minor-details/biology" title="Biology (Minor)">Biology (Minor)</a>',
    saveEntries: async (entries) => saved.push(...entries),
  });

  assert.equal(result.programs_imported, 1);
  assert.deepEqual(saved.map((entry) => entry.id), ["catalog-sasnb-biology-minor"]);
  await assert.rejects(
    importProgramDirectory({
      source: DIRECTORY_SOURCE,
      fetchHtml: async () => "<html>No programs here</html>",
      saveEntries: async () => assert.fail("empty imports must not write"),
    }),
    /parsed zero programs/
  );
});
