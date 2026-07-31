import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_mathematics_minor.sql", import.meta.url);

test("the Mathematics minor seed records the published SAS requirements", async () => {
  assert.equal(
    existsSync(seedUrl),
    true,
    "reviewed SAS Mathematics minor seed must exist before it can be released"
  );

  const seed = await readFile(seedUrl, "utf8");
  for (const code of ["01:640:151", "01:640:152", "01:640:251", "01:640:250", "01:640:244", "01:640:252"]) {
    assert.match(seed, new RegExp(`'${code}'`));
  }
  assert.match(seed, /'sasnb-mathematics-minor'/);
  assert.match(seed, /'640'/);
  assert.match(seed, /'sasnb-mathematics-640'/);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /"course_number_max":499/);
  assert.match(seed, /"exclude_course_codes":\["01:640:491","01:640:492"\]/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /At least three out of the four elective courses must be taken at Rutgers - New Brunswick\/Piscataway/);
});
