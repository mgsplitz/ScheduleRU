import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const majorSeedUrl = new URL("../schema/review_sas_sociology_major.sql", import.meta.url);
const minorSeedUrl = new URL("../schema/review_sas_sociology_minor.sql", import.meta.url);

test("the Sociology major seed preserves the current five-course core and elective thresholds", async () => {
  assert.equal(existsSync(majorSeedUrl), true, "reviewed SAS Sociology major seed must exist before release");
  const seed = await readFile(majorSeedUrl, "utf8");
  assert.match(seed, /'sasnb-sociology-ba'/);
  assert.match(seed, /'Sociology'/);
  assert.match(seed, /'920'/);
  assert.match(seed, /'B\.A\.'/);
  assert.match(seed, /'sasnb-sociology-920'/);
  for (const code of ["01:920:101", "01:920:215", "01:920:311", "01:920:312", "01:920:316"]) {
    assert.equal(seed.includes(code), true, `the reviewed major seed must retain ${code}`);
  }
  assert.match(seed, /'sasnb-sociology-ba-electives'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-sociology-ba-upper-electives'.*'min_courses',3/s);
  assert.match(seed, /"subject_codes":\["920"\]/);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /"exclude_course_codes":\["01:920:101","01:920:215","01:920:311","01:920:312","01:920:316"\]/);
  assert.match(seed, /different thematic/);
  assert.match(seed, /six courses \(21 credits\) at Rutgers-New Brunswick/);
  assert.match(seed, /'sasnb-sociology-major-no-health-and-society-minor'/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Sociology minor seed preserves its core choice and nested elective levels", async () => {
  assert.equal(existsSync(minorSeedUrl), true, "reviewed SAS Sociology minor seed must exist before release");
  const seed = await readFile(minorSeedUrl, "utf8");
  assert.match(seed, /'sasnb-sociology-minor'/);
  assert.match(seed, /'minor'/);
  assert.match(seed, /'920'/);
  assert.match(seed, /'sasnb-sociology-920'/);
  assert.match(seed, /'sasnb-sociology-minor-method-or-theory'.*'one_of'/s);
  assert.match(seed, /'sasnb-sociology-minor-electives'.*'min_courses',4/s);
  for (const code of ["01:920:101", "01:920:311", "01:920:312", "01:920:316"]) {
    assert.equal(seed.includes(code), true, `the reviewed minor seed must retain ${code}`);
  }
  for (const level of [200, 300, 315]) assert.match(seed, new RegExp(`"course_number_min":${level}`));
  assert.match(seed, /C\+ grade or higher/);
  assert.match(seed, /three courses \(10 credits\) at Rutgers-New Brunswick/);
  assert.match(seed, /Citizenship and Service Education/);
  assert.match(seed, /'sasnb-criminal-justice-major-sociology-minor-criminology-exclusion'/);
  assert.match(seed, /program_requirement_evidence/);
});
