import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_philosophy_minor.sql", import.meta.url);

test("the Philosophy minor seed preserves its published course and upper-level thresholds", async () => {
  assert.equal(existsSync(seedUrl), true, "the reviewed Philosophy minor seed must exist");
  const seed = await readFile(seedUrl, "utf8");
  assert.match(seed, /'sasnb-philosophy-minor'/);
  assert.match(seed, /'minor'/);
  assert.match(seed, /'730'/);
  assert.match(seed, /'sasnb-philosophy-730'/);
  assert.match(seed, /'sasnb-philosophy-minor-total'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-philosophy-minor-upper-level'.*'min_courses',3/s);
  assert.match(seed, /"subject_codes":\["730"\]/);
  assert.match(seed, /"course_number_min":100/);
  assert.match(seed, /"course_number_max":499/);
  assert.match(seed, /"minimum_credits":3/);
  assert.match(seed, /https:\/\/philosophy\.rutgers\.edu\/minor/);
});
