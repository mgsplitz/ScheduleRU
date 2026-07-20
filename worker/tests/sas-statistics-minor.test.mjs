import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_statistics_minor.sql", import.meta.url);

test("the Statistics minor seed preserves its required course, distinct additional courses, and advanced subset", async () => {
  assert.equal(existsSync(seedUrl), true, "the reviewed Statistics minor seed must exist");
  const seed = await readFile(seedUrl, "utf8");
  assert.match(seed, /'sasnb-statistics-minor'/);
  assert.match(seed, /'minor'/);
  assert.match(seed, /'960'/);
  assert.match(seed, /'sasnb-statistics-960'/);
  assert.match(seed, /'sasnb-statistics-minor-required'.*'min_courses',1/s);
  assert.match(seed, /'sasnb-statistics-minor-additional'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-statistics-minor-advanced'.*'min_courses',3/s);
  for (const code of ["01:960:295", "01:960:390", "01:198:142", "01:640:477", "01:640:481", "01:960:365", "01:960:490"]) {
    assert.equal(seed.includes(code), true, `the reviewed seed must retain ${code}`);
  }
  assert.match(seed, /"subject_codes":\["960"\]/);
  assert.match(seed, /"exclude_course_codes":\["01:960:295","01:960:390"\]/);
  assert.match(seed, /https:\/\/statistics\.rutgers\.edu\/minor/);
});
