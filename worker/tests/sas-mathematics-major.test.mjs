import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_mathematics_major.sql", import.meta.url);

test("the Mathematics major seed separates the published B.A. and Honors B.S. paths", async () => {
  assert.equal(
    existsSync(seedUrl),
    true,
    "reviewed SAS Mathematics major seed must exist before it can be released"
  );

  const seed = await readFile(seedUrl, "utf8");
  for (const id of ["sasnb-mathematics-ba", "sasnb-mathematics-honors-bs"]) {
    assert.match(seed, new RegExp(`'${id}'`));
  }
  for (const code of [
    "01:640:151", "01:640:152", "01:640:251", "01:640:250", "01:640:252",
    "01:640:300", "01:640:311", "01:640:312", "01:640:350", "01:640:351",
    "01:640:411", "01:640:412", "01:640:451", "01:640:452", "01:640:291",
    "01:640:292", "01:640:196", "01:640:491", "01:640:492",
  ]) {
    assert.match(seed, new RegExp(`'${code}'`));
  }
  assert.match(seed, /'B\.A\.'/);
  assert.match(seed, /'B\.S\.'/);
  assert.match(seed, /'sasnb-mathematics-640'/);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /"course_number_max":499/);
  assert.match(seed, /"minimum_credits":3/);
  assert.match(seed, /"01:640:300","01:640:411","01:640:412","01:640:451","01:640:452"/);
  assert.match(seed, /Honors admission and approved substitutions/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /math\.rutgers\.edu\/academics\/undergraduate\/majors/);
  assert.match(seed, /honors-track-option/);
});
