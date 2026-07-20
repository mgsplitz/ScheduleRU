import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_statistics_major.sql", import.meta.url);

test("the Statistics major seed retains its published core, alternatives, and elective boundaries", async () => {
  assert.equal(existsSync(seedUrl), true, "reviewed SAS Statistics major seed must exist before release");

  const seed = await readFile(seedUrl, "utf8");
  for (const code of [
    "01:198:107", "01:198:110", "01:198:111", "01:198:170",
    "01:640:151", "01:640:152", "01:640:250", "01:640:251", "01:640:252",
    "01:960:381", "01:960:382", "01:960:212", "01:960:384", "01:960:295", "01:960:390", "01:960:463", "01:960:486", "01:960:490",
    "01:960:365", "01:960:467", "01:960:476", "01:960:483",
  ]) assert.match(seed, new RegExp(`'${code}'`));
  assert.match(seed, /'sasnb-statistics-major'/);
  assert.match(seed, /'960'/);
  assert.match(seed, /'sasnb-statistics-960'/);
  assert.match(seed, /'min_courses', 1/);
  assert.match(seed, /'min_courses', 2/);
  assert.match(seed, /"subject_codes":\["640"\]/);
  assert.match(seed, /"exclude_course_codes":\["01:640:477","01:640:481"\]/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /No courses with grade D can be counted toward the major/);
});
