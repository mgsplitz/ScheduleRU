import assert from "node:assert/strict";
import test from "node:test";
import {
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
