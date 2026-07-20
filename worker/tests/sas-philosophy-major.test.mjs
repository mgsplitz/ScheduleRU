import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_philosophy_major.sql", import.meta.url);

test("the Philosophy BA seed retains its published core areas and whole-major thresholds", async () => {
  assert.equal(existsSync(seedUrl), true, "reviewed SAS Philosophy BA seed must exist before release");
  const seed = await readFile(seedUrl, "utf8");
  for (const code of [
    "01:730:109", "01:730:201", "01:730:315", "01:730:407", "01:730:408",
    "01:730:301", "01:730:302", "01:730:304", "01:190:322", "01:730:352", "01:190:353",
    "01:730:307", "01:730:308", "01:730:404", "01:730:416",
    "01:730:330", "01:730:341", "01:730:441", "01:730:470",
    "01:730:210", "01:730:225", "01:730:420", "01:730:435",
  ]) assert.match(seed, new RegExp(`'${code}'`));
  assert.match(seed, /'sasnb-philosophy-major'/);
  assert.match(seed, /'730'/);
  assert.match(seed, /'sasnb-philosophy-730'/);
  assert.match(seed, /'min_courses',\s*11/);
  assert.match(seed, /'min_courses',\s*6/);
  assert.match(seed, /'min_courses',\s*2/);
  assert.match(seed, /'min_courses',\s*1/);
  assert.match(seed, /"kind":"subject_level"/);
  assert.match(seed, /"minimum_credits":3/);
  assert.match(seed, /"exclude_course_codes":\["01:730:201","01:730:202","01:730:295","01:730:296"\]/);
  assert.match(seed, /program_requirement_evidence/);
});
