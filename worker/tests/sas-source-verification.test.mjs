import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateProgramDefinition } from "../../packages/catalog/src/index.ts";

const sourceVerifiedIds = [
  "sasnb-anthropology-cultural-minor",
  "sasnb-anthropology-evolutionary-minor",
  "sasnb-anthropology-general-minor",
  "sasnb-arabic-minor",
  "sasnb-chinese-minor",
  "sasnb-chinese-major",
  "sasnb-classics-greek-latin-major",
  "sasnb-classics-greek-major",
  "sasnb-classics-latin-major",
  "sasnb-comparative-literature-minor",
  "sasnb-creative-writing-minor",
  "sasnb-hindi-minor",
  "sasnb-japanese-major",
  "sasnb-japanese-minor",
  "sasnb-korean-major",
  "sasnb-korean-minor",
  "sasnb-history-stem-society-minor",
];

test("source-verified SAS drafts remain valid, non-public, and pending academic review", async () => {
  const verification = await readFile(
    new URL("../../catalog/ingestion/sas-review-verification.md", import.meta.url),
    "utf8",
  );

  for (const id of sourceVerifiedIds) {
    const definition = JSON.parse(await readFile(
      new URL(`../../catalog/drafts/${id}.v1.json`, import.meta.url),
      "utf8",
    ));
    assert.equal(validateProgramDefinition(definition).ok, true, `${id} must validate`);
    assert.equal(definition.program.review_status, "unreviewed");
    assert.ok(definition.sources.length >= 2, `${id} must have corroborating Rutgers sources`);
    assert.ok(definition.sources.every(({ url }) => new URL(url).hostname.endsWith("rutgers.edu")));
    assert.match(verification, new RegExp(`\\b${id}\\b`));
  }
});

test("STEM in Society preserves the current six-course finite catalog pool", async () => {
  const definition = JSON.parse(await readFile(
    new URL("../../catalog/drafts/sasnb-history-stem-society-minor.v1.json", import.meta.url),
    "utf8",
  ));
  const total = definition.requirement_groups[0];
  assert.deepEqual([total.rule, total.count], ["min_courses", 6]);
  assert.equal(total.selectors[0].selector.include_course_codes.length, 33);
  assert.deepEqual(definition.eligibility_rules, [{
    key: "sasnb-history-stem-society-history-major-restriction",
    condition_type: "selected_program_must_not_include_any",
    condition_value: ["sasnb-history-major"],
    decision: "blocked",
    note: "History (510) majors may not minor in History — STEM in Society (519).",
    source_id: "source-003",
    review_status: "unreviewed",
    verified_at: 1787011200000,
  }]);
});

test("Chinese major treats all four currently classified Classical Chinese courses as valid", async () => {
  const definition = JSON.parse(await readFile(
    new URL("../../catalog/drafts/sasnb-chinese-major.v1.json", import.meta.url),
    "utf8",
  ));
  const classical = definition.requirement_groups.find(
    ({ id }) => id === "sasnb-chinese-major-classical",
  );
  assert.deepEqual(
    classical.selectors[0].selector.include_course_codes,
    ["01:165:321", "01:165:322", "01:165:419", "01:165:420"],
  );
});

test("source verification is explicitly distinct from reviewed publication", async () => {
  const verification = await readFile(
    new URL("../../catalog/ingestion/sas-review-verification.md", import.meta.url),
    "utf8",
  );
  assert.match(verification, /DRAFT_SOURCE_VERIFIED/);
  assert.match(verification, /does not constitute independent academic review/i);
  assert.match(verification, /must remain `unreviewed`/i);
});
