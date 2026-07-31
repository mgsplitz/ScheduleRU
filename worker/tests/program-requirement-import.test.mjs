import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverNestedMajorRequirementPage,
  discoverProfileRequirementPage,
  extractRequirementDraftCandidate,
  importProgramRequirementSource,
  parseProgramRequirementSource,
} from "../src/program-requirement-import.js";

const SOURCE = {
  id: "sasnb-example-major-profile",
  program_id: "sasnb-catalog-example-major",
  source_url: "https://department.rutgers.edu/undergraduate/example-major",
  source_title: "Example Major Requirements",
  adapter: "html_requirement_source_v1",
};

test("an official requirements source becomes a source-backed draft snapshot, not a reviewed audit", () => {
  const snapshot = parseProgramRequirementSource(`
    <html><head><title>Example Major Requirements</title><style>.hidden { display: none; }</style></head>
    <body>
      <nav>Student resources</nav>
      <main>
        <h1>Example Major Requirements</h1>
        <h2>Required courses</h2>
        <p>Complete 01:123:101 and 01:123:102.</p>
        <h2>Advanced electives</h2>
        <p>Choose two courses from 01:123:301, 01:123:302, or 01:123:401.</p>
      </main>
      <script>window.navigation = "ignore me";</script>
    </body></html>
  `, SOURCE);

  assert.equal(snapshot.source_id, SOURCE.id);
  assert.equal(snapshot.program_id, SOURCE.program_id);
  assert.equal(snapshot.source_url, SOURCE.source_url);
  assert.equal(snapshot.source_title, "Example Major Requirements");
  assert.deepEqual(snapshot.headings, ["Example Major Requirements", "Required courses", "Advanced electives"]);
  assert.deepEqual(snapshot.course_codes, ["01:123:101", "01:123:102", "01:123:301", "01:123:302", "01:123:401"]);
  assert.match(snapshot.content_text, /Choose two courses/);
  assert.doesNotMatch(snapshot.content_text, /Student resources|ignore me/);
  assert.equal("review_status" in snapshot, false);
  assert.equal("requirements_available" in snapshot, false);
});

test("the requirements importer saves only a non-empty official HTTPS snapshot", async () => {
  const saved = [];
  const result = await importProgramRequirementSource({
    source: SOURCE,
    fetchHtml: async () => "<main><h1>Example</h1><p>01:123:101</p></main>",
    saveSnapshot: async (snapshot) => saved.push(snapshot),
  });

  assert.equal(result.source_id, SOURCE.id);
  assert.equal(result.program_id, SOURCE.program_id);
  assert.equal(result.courses_found, 1);
  assert.equal(saved.length, 1);
  assert.match(saved[0].content_hash, /^[a-f0-9]{16}$/);

  await assert.rejects(
    importProgramRequirementSource({
      source: { ...SOURCE, source_url: "http://department.rutgers.edu/example" },
      fetchHtml: async () => assert.fail("unsafe source must not be fetched"),
      saveSnapshot: async () => assert.fail("unsafe source must not be saved"),
    }),
    /valid official HTTPS source/
  );
});

test("a requirement snapshot becomes labeled source-section candidates without inferring degree rules", () => {
  const candidate = extractRequirementDraftCandidate({
    source_id: SOURCE.id,
    program_id: SOURCE.program_id,
    source_url: SOURCE.source_url,
    content_hash: "0123456789abcdef",
    content_text: [
      "Example Major Requirements",
      "Required courses",
      "Complete 01:123:101 and 01:123:102.",
      "Advanced electives",
      "Choose two courses from 01:123:301, 01:123:302, or 01:123:401.",
    ].join("\n"),
    parsed_json: JSON.stringify({
      version: 1,
      headings: ["Example Major Requirements", "Required courses", "Advanced electives"],
      course_codes: ["01:123:101", "01:123:102", "01:123:301", "01:123:302", "01:123:401"],
    }),
  });

  assert.deepEqual(candidate, {
    extractor_version: 1,
    source_id: SOURCE.id,
    program_id: SOURCE.program_id,
    source_url: SOURCE.source_url,
    content_hash: "0123456789abcdef",
    sections: [
      {
        heading: "Required courses",
        source_text: "Complete 01:123:101 and 01:123:102.",
        course_codes: ["01:123:101", "01:123:102"],
      },
      {
        heading: "Advanced electives",
        source_text: "Choose two courses from 01:123:301, 01:123:302, or 01:123:401.",
        course_codes: ["01:123:301", "01:123:302", "01:123:401"],
      },
    ],
  });
  assert.equal("rule" in candidate.sections[0], false);
  assert.equal("count" in candidate.sections[1], false);
});

test("a SAS profile yields its official Major Web Page", () => {
  const detail = discoverProfileRequirementPage(`
    <li class="field-entry major-url"><a href="https://www.math.rutgers.edu/academics/undergraduate/majors">Major Web Page</a></li>
    <li class="field-entry minor-url"><a href="https://www.math.rutgers.edu/academics/undergraduate/minors">Minor Web Page</a></li>
  `, SOURCE, "major");

  assert.deepEqual(detail, {
    source_url: "https://www.math.rutgers.edu/academics/undergraduate/majors",
    source_title: "Official major requirements",
    source_kind: "requirements_page",
  });
});

test("an official overview page yields only its explicitly labeled major requirements link", () => {
  const detail = discoverNestedMajorRequirementPage(`
    <main>
      <a href="/academics/undergraduate/anthropology-major-requirements">Major Requirements</a>
      <a href="/academics/undergraduate/anthropology-minor-requirements">Minor Requirements</a>
      <a href="https://example.com/advising">Advising</a>
    </main>
  `, SOURCE);

  assert.deepEqual(detail, {
    source_url: "https://department.rutgers.edu/academics/undergraduate/anthropology-major-requirements",
    source_title: "Official detailed major requirements",
    source_kind: "requirements_page",
  });
});

test("nested major requirement discovery rejects unrelated and self-referential links", () => {
  assert.equal(
    discoverNestedMajorRequirementPage('<a href="https://department.rutgers.edu/minor">Minor Requirements</a>', SOURCE),
    null,
  );
  assert.equal(
    discoverNestedMajorRequirementPage(`<a href="${SOURCE.source_url}">Major Requirements</a>`, SOURCE),
    null,
  );
});

test("major-page discovery rejects minor, non-Rutgers, and malformed links", () => {
  assert.equal(
    discoverProfileRequirementPage('<a href="https://example.com/requirements">Major Web Page</a>', SOURCE, "major"),
    null,
  );
  assert.equal(
    discoverProfileRequirementPage('<a href="https://math.rutgers.edu/minors">Minor Web Page</a>', SOURCE, "major"),
    null,
  );
  assert.equal(
    discoverProfileRequirementPage('<a href="https://math.rutgers.edu/major">Major Web Page</a>', SOURCE, "minor"),
    null,
  );
});
