import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_criminology_minor.sql", import.meta.url);

test("the Criminology minor seed preserves its fixed core, finite Sociology elective, and separate Criminal Justice elective", async () => {
  assert.equal(existsSync(seedUrl), true, "the reviewed Criminology minor seed must exist");
  const seed = await readFile(seedUrl, "utf8");
  assert.match(seed, /'sasnb-criminology-minor'/);
  assert.match(seed, /'minor'/);
  assert.match(seed, /'204'/);
  assert.match(seed, /'sasnb-criminology-204'/);
  assert.match(seed, /'sasnb-criminology-minor-core'.*'all'/s);
  assert.match(seed, /'sasnb-criminology-minor-sociology-elective'.*'min_courses',1/s);
  assert.match(seed, /'sasnb-criminology-minor-criminal-justice-elective'.*'min_courses',1/s);
  for (const code of ["01:202:201", "01:830:101", "01:830:340", "01:920:101", "01:920:222", "01:920:306", "01:920:304", "01:920:307", "01:920:349"]) {
    assert.equal(seed.includes(code), true, `the reviewed seed must retain ${code}`);
  }
  assert.match(seed, /"subject_codes":\["202"\]/);
  assert.match(seed, /"exclude_course_codes":\["01:202:201"\]/);
  assert.match(seed, /"minimum_credits":3/);
  assert.match(seed, /'sasnb-criminal-justice-major-no-criminology-minor'/);
  assert.match(seed, /https:\/\/sociology\.rutgers\.edu\/images\/stories\/stories\/pdfs\/Criminology_Minor_Requirement_form1\.pdf/);
  assert.match(seed, /https:\/\/sasundergrad\.rutgers\.edu\/majors-and-core-curriculum\/major\/major-minor-details\/criminology/);
});
