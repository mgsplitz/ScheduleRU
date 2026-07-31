import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const humanitiesUrl = new URL("../schema/review_sas_classical_humanities_minor.sql", import.meta.url);
const latinUrl = new URL("../schema/review_sas_latin_minor.sql", import.meta.url);
const greekUrl = new URL("../schema/review_sas_ancient_greek_minor.sql", import.meta.url);

test("the Classical Humanities minor seed retains its seven-course and upper-level structure", async () => {
  assert.equal(existsSync(humanitiesUrl), true, "reviewed Classical Humanities minor seed must exist before release");
  const seed = await readFile(humanitiesUrl, "utf8");
  assert.match(seed, /'sasnb-classical-humanities-minor'/);
  assert.match(seed, /'190'/);
  assert.match(seed, /'sasnb-classical-humanities-190'/);
  assert.match(seed, /'sasnb-classical-humanities-minor-total'.*'min_courses',7/s);
  assert.match(seed, /'sasnb-classical-humanities-minor-upper-level'.*'min_courses',3/s);
  for (const subject of ["190", "490", "580"]) assert.match(seed, new RegExp(`"${subject}"`));
  assert.match(seed, /approved classical humanities courses in other departments/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Latin minor seed retains its six Latin-course and three upper-level-course requirements", async () => {
  assert.equal(existsSync(latinUrl), true, "reviewed Latin minor seed must exist before release");
  const seed = await readFile(latinUrl, "utf8");
  assert.match(seed, /'sasnb-latin-minor'/);
  assert.match(seed, /'580'/);
  assert.match(seed, /'sasnb-latin-580'/);
  assert.match(seed, /'sasnb-latin-minor-total'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-latin-minor-upper-level'.*'min_courses',3/s);
  assert.match(seed, /"subject_codes":\["580"\]/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Ancient Greek minor seed retains its program code, Greek selector, and upper-level requirement", async () => {
  assert.equal(existsSync(greekUrl), true, "reviewed Ancient Greek minor seed must exist before release");
  const seed = await readFile(greekUrl, "utf8");
  assert.match(seed, /'sasnb-ancient-greek-minor'/);
  assert.match(seed, /'491'/);
  assert.match(seed, /'sasnb-ancient-greek-491'/);
  assert.match(seed, /'sasnb-ancient-greek-minor-total'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-ancient-greek-minor-upper-level'.*'min_courses',3/s);
  assert.match(seed, /"subject_codes":\["490"\]/);
  assert.match(seed, /program_requirement_evidence/);
});
