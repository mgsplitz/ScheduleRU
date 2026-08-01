import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const definition = JSON.parse(await readFile(
  new URL("../../catalog/drafts/sasnb-ppe-minor.v1.json", import.meta.url),
  "utf8",
));
const backlog = JSON.parse(await readFile(
  new URL("../../catalog/ingestion/review-backlog.v1.json", import.meta.url),
  "utf8",
));
const inventory = await readFile(
  new URL("../../SAS_PILOT_SOURCE_INVENTORY.md", import.meta.url),
  "utf8",
);

test("PPE remains an evidence-gated non-public draft", () => {
  assert.deepEqual(
    [
      definition.program.id,
      definition.program.academic_program_code,
      definition.program.school_slug,
      definition.program.review_status,
      definition.program.requirement_evidence_required,
    ],
    ["sasnb-ppe-minor", "792", "sasnb", "unreviewed", true],
  );
  assert.ok(
    definition.requirement_groups.every(
      ({ evidence, courses }) => (
        evidence.review_status === "unreviewed"
        && courses.every((course) => course.evidence.review_status === "unreviewed")
      ),
    ),
  );
});

test("PPE blockers live in the portable review backlog", () => {
  const notes = backlog.review_notes.filter(
    ({ program_id }) => program_id === "sasnb-ppe-minor",
  );
  assert.equal(notes.length, 5);
  assert.ok(notes.every(({ resolved }) => resolved === false));
  const text = notes.map(({ raw_text }) => raw_text).join("\n");
  assert.match(text, /01:730:105\/106/);
  assert.match(text, /case-by-case/i);
  assert.match(text, /cross listed.*only one requirement/i);
  assert.match(text, /grade of C or better/i);
  assert.match(text, /only one course.*in each field.*outside Rutgers University-New Brunswick/i);
});

test("source inventory retains the current-source boundary and every PPE blocker", () => {
  assert.match(inventory, /Current department page; no catalog-year boundary stated\./);
  assert.match(inventory, /01:730:105\/106/);
  assert.match(inventory, /case-by-case/i);
  assert.match(inventory, /cross-listed.*only one requirement/i);
  assert.match(inventory, /C or better/i);
  assert.match(inventory, /only one course in each field can come from transfer credit/i);
});
