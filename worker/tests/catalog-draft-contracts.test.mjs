import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { validateProgramDefinition } from "../../packages/catalog/src/index.ts";
import { allProgramDefinitions } from "./helpers/catalog-snapshot.mjs";

const draftDirectory = new URL("../../catalog/drafts/", import.meta.url);

async function loadDrafts() {
  const files = (await readdir(draftDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  return Promise.all(files.map(async (file) => ({
    file,
    definition: JSON.parse(await readFile(new URL(file, draftDirectory), "utf8")),
  })));
}

test("portable draft definitions are valid, non-public, and distinct from reviewed programs", async () => {
  const drafts = await loadDrafts();
  assert.deepEqual(
    drafts.map(({ definition }) => definition.program.id),
    ["rbsnb-fixed-income-credit-analysis-concentration", "sasnb-ppe-minor"],
  );
  const reviewedIds = new Set(
    allProgramDefinitions().map(({ program }) => program.id),
  );
  for (const { file, definition } of drafts) {
    const result = validateProgramDefinition(definition);
    assert.equal(result.ok, true, `${file} failed validation`);
    assert.ok(["unreviewed", "needs_fix"].includes(definition.program.review_status));
    assert.equal(reviewedIds.has(definition.program.id), false);
    assert.ok(
      definition.requirement_groups.every(
        ({ evidence }) => evidence?.review_status !== "reviewed",
      ),
    );
  }
});

test("Fixed Income preserves its finite core and unresolved elective boundary", async () => {
  const [{ definition }] = (await loadDrafts()).filter(
    ({ definition }) => (
      definition.program.id
      === "rbsnb-fixed-income-credit-analysis-concentration"
    ),
  );
  const required = definition.requirement_groups.find(
    ({ id }) => id.endsWith("-required"),
  );
  const elective = definition.requirement_groups.find(
    ({ id }) => id.endsWith("-elective"),
  );
  assert.deepEqual(
    required.courses.map(({ code }) => code),
    [
      "33:390:380", "33:390:385", "33:390:400",
      "33:390:420", "33:390:490", "33:390:491",
    ],
  );
  assert.deepEqual([elective.rule, elective.count, elective.courses], ["min_courses", 1, []]);
  assert.deepEqual(
    definition.eligibility_rules.map(({ key }) => key),
    [
      "rbsnb-fixed-income-credit-analysis-concentration-rbs-only",
      "rbsnb-fixed-income-credit-analysis-finance-only",
      "rbsnb-fixed-income-credit-analysis-grade",
    ],
  );
});

test("PPE preserves only its 63 finite source candidates", async () => {
  const [{ definition }] = (await loadDrafts()).filter(
    ({ definition }) => definition.program.id === "sasnb-ppe-minor",
  );
  const codes = definition.requirement_groups.flatMap(
    ({ courses }) => courses.map(({ code }) => code),
  );
  assert.equal(codes.length, 63);
  assert.equal(new Set(codes).size, 63);
  assert.equal(codes.includes("01:730:105"), false);
  assert.equal(codes.includes("01:730:106"), false);
  assert.deepEqual(
    definition.requirement_groups.map(({ id, rule, count }) => ({ id, rule, count })),
    [
      { id: "sasnb-ppe-philosophy", rule: "min_courses", count: 3 },
      { id: "sasnb-ppe-political-theory", rule: "min_courses", count: 1 },
      { id: "sasnb-ppe-political-policy", rule: "min_courses", count: 2 },
      { id: "sasnb-ppe-economics-foundations", rule: "all", count: null },
      { id: "sasnb-ppe-economics-elective", rule: "min_courses", count: 1 },
    ],
  );
});
