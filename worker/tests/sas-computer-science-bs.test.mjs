import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_computer_science_bs.sql", import.meta.url);

test("the Computer Science BS seed retains its published core, elective, and laboratory-science paths", async () => {
  assert.equal(existsSync(seedUrl), true, "reviewed SAS Computer Science BS seed must exist before release");
  const seed = await readFile(seedUrl, "utf8");
  for (const code of [
    "01:198:111", "01:198:112", "01:198:205", "01:198:206", "01:198:211", "01:198:344",
    "01:640:151", "01:640:152", "01:640:250",
    "01:750:203", "01:750:204", "01:750:205", "01:750:206",
    "01:750:123", "01:750:124", "01:750:227", "01:750:229",
    "01:750:271", "01:750:272", "01:750:275", "01:750:276",
    "01:750:201", "01:750:202", "01:750:193", "01:750:194",
    "01:160:159", "01:160:160", "01:160:171", "01:160:161", "01:160:162", "01:160:163", "01:160:164",
  ]) assert.match(seed, new RegExp(`'${code}'`));
  assert.match(seed, /'sasnb-computer-science-bs'/);
  assert.match(seed, /'198S'/);
  assert.match(seed, /'sasnb-computer-science-198'/);
  assert.match(seed, /'one_of'/);
  assert.match(seed, /'min_courses',\s*7/);
  assert.match(seed, /'min_courses',\s*5/);
  assert.match(seed, /'min_courses',\s*2/);
  assert.match(seed, /'max',\s*1/);
  assert.match(seed, /All CS electives required for the BA\/BS degree must be completed in the last 10 years/);
  assert.match(seed, /program_requirement_evidence/);
});
