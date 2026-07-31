import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_physics_general_major.sql", import.meta.url);

test("the Physics General Option seed keeps the published fixed core, complete lab paths, and a bounded upper-level physics selector", async () => {
  assert.equal(existsSync(seedUrl), true, "reviewed SAS Physics General Option seed must exist before release");
  const seed = await readFile(seedUrl, "utf8");
  assert.match(seed, /'sasnb-physics-general-ba'/);
  assert.match(seed, /'Physics - General Option'/);
  assert.match(seed, /'750'/);
  assert.match(seed, /'B\.A\.'/);
  assert.match(seed, /'sasnb-physics-750'/);

  for (const code of [
    "01:750:203", "01:750:204", "01:750:205", "01:750:206",
    "01:750:229", "01:750:230", "01:750:275", "01:750:276",
    "01:750:313", "01:750:323", "01:750:324",
    "01:750:326", "01:750:327", "01:750:345", "01:750:346",
  ]) assert.equal(seed.includes(code), true, `the reviewed seed must retain ${code}`);

  assert.match(seed, /'sasnb-physics-general-ba-laboratories'.*'one_of'/s);
  assert.match(seed, /'sasnb-physics-general-ba-advanced-labs'.*'one_of'/s);
  assert.match(seed, /"subject_codes":\["750"\]/);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /"course_number_max":489/);
  assert.match(seed, /"exclude_course_codes":\["01:750:313","01:750:323","01:750:324","01:750:326","01:750:327","01:750:345","01:750:346"\]/);
  assert.match(seed, /any other equivalent sequence/);
  assert.match(seed, /Two terms of any calculus sequence/);
  assert.match(seed, /18 additional credits/);
  assert.match(seed, /C average/);
  assert.match(seed, /15 credits of physics courses at the 300-level or higher/);
  assert.match(seed, /program_requirement_evidence/);
});
