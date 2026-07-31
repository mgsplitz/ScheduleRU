import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const religionUrl = new URL("../schema/review_sas_religion_minor.sql", import.meta.url);
const physicsUrl = new URL("../schema/review_sas_physics_minor.sql", import.meta.url);
const astronomyUrl = new URL("../schema/review_sas_astronomy_minor.sql", import.meta.url);

test("the Religion minor seed retains the current six-course and upper-level structure", async () => {
  assert.equal(existsSync(religionUrl), true, "reviewed Religion minor seed must exist before release");
  const seed = await readFile(religionUrl, "utf8");
  assert.match(seed, /'sasnb-religion-minor'/);
  assert.match(seed, /'840'/);
  assert.match(seed, /'sasnb-religion-840'/);
  assert.match(seed, /'sasnb-religion-minor-total'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-religion-minor-upper-level'.*'min_courses',3/s);
  assert.match(seed, /"subject_codes":\["840"\]/);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /cognate and transfer courses/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Physics minor seed retains its reviewed sequence options and 12 advanced credits", async () => {
  assert.equal(existsSync(physicsUrl), true, "reviewed Physics minor seed must exist before release");
  const seed = await readFile(physicsUrl, "utf8");
  assert.match(seed, /'sasnb-physics-minor'/);
  assert.match(seed, /'750'/);
  assert.match(seed, /'sasnb-physics-750'/);
  for (const code of ["01:750:203", "01:750:204", "01:750:205", "01:750:206", "01:750:229", "01:750:230", "01:750:275", "01:750:276"]) {
    assert.equal(seed.includes(code), true, `published Physics minor course ${code} must be retained`);
  }
  assert.match(seed, /'sasnb-physics-minor-advanced'.*'min_credits',12/s);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Astronomy minor seed retains its lab alternatives, advanced astronomy options, and Astrophysics exclusion", async () => {
  assert.equal(existsSync(astronomyUrl), true, "reviewed Astronomy minor seed must exist before release");
  const seed = await readFile(astronomyUrl, "utf8");
  assert.match(seed, /'sasnb-astronomy-minor'/);
  assert.match(seed, /'100'/);
  assert.match(seed, /'sasnb-astronomy-100'/);
  for (const code of ["01:750:341", "01:750:342", "01:750:345", "01:750:346", "01:750:441", "01:750:442", "01:750:443", "01:750:444"]) {
    assert.equal(seed.includes(code), true, `published Astronomy minor course ${code} must be retained`);
  }
  assert.match(seed, /'sasnb-astronomy-minor-advanced'.*'min_courses',2/s);
  assert.match(seed, /'sasnb-astronomy-minor-no-astrophysics'/);
  assert.match(seed, /program_requirement_evidence/);
});
