import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const artHistoryUrl = new URL("../schema/review_sas_art_history_minor.sql", import.meta.url);
const psychologyUrl = new URL("../schema/review_sas_psychology_minor.sql", import.meta.url);
const developmentalPsychologyUrl = new URL("../schema/review_sas_developmental_psychology_minor.sql", import.meta.url);

test("the Art History minor seed retains its two-introduction and four upper-level-course structure", async () => {
  assert.equal(existsSync(artHistoryUrl), true, "reviewed Art History minor seed must exist before release");
  const seed = await readFile(artHistoryUrl, "utf8");
  assert.match(seed, /'sasnb-art-history-minor'/);
  assert.match(seed, /'082'/);
  assert.match(seed, /'sasnb-art-history-082'/);
  assert.match(seed, /'sasnb-art-history-minor-introductions'.*'min_courses',2/s);
  assert.match(seed, /'sasnb-art-history-minor-upper-level'.*'min_courses',4/s);
  for (const code of ["01:082:105", "01:082:106", "01:082:107"]) assert.equal(seed.includes(code), true, `introduction ${code} must remain selectable`);
  assert.match(seed, /"course_number_min":200/);
  assert.match(seed, /grade of C or better/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Psychology minor seed retains its fixed introduction, five additional courses, and 200-level limit", async () => {
  assert.equal(existsSync(psychologyUrl), true, "reviewed Psychology minor seed must exist before release");
  const seed = await readFile(psychologyUrl, "utf8");
  assert.match(seed, /'sasnb-psychology-minor'/);
  assert.match(seed, /'830'/);
  assert.match(seed, /'sasnb-psychology-830'/);
  assert.match(seed, /'sasnb-psychology-minor-intro'.*'all'/s);
  assert.match(seed, /'01:830:101'/);
  assert.match(seed, /'sasnb-psychology-minor-electives'.*'min_courses',5/s);
  assert.match(seed, /'sasnb-psychology-minor-200-limit'.*'max_courses',2/s);
  assert.match(seed, /"course_number_min":200/);
  assert.match(seed, /'sasnb-psychology-minor-no-developmental-psychology'/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Developmental Psychology minor seed retains its two-course core, reviewed electives, and fieldwork cap", async () => {
  assert.equal(existsSync(developmentalPsychologyUrl), true, "reviewed Developmental Psychology minor seed must exist before release");
  const seed = await readFile(developmentalPsychologyUrl, "utf8");
  assert.match(seed, /'sasnb-developmental-psychology-minor'/);
  assert.match(seed, /'835'/);
  assert.match(seed, /'sasnb-developmental-psychology-835'/);
  for (const code of ["01:830:101", "01:830:271", "01:830:331", "01:830:484"]) assert.equal(seed.includes(code), true, `published course ${code} must be retained`);
  assert.match(seed, /'sasnb-developmental-psychology-minor-electives'.*'min_courses',4/s);
  assert.match(seed, /'sasnb-developmental-psychology-minor-fieldwork-limit'.*'max_courses',1/s);
  assert.match(seed, /'sasnb-developmental-psychology-minor-no-psychology'/);
  assert.match(seed, /program_requirement_evidence/);
});
