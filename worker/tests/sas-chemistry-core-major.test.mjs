import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_chemistry_core_major.sql", import.meta.url);

test("the Chemistry Core Option seed preserves each published complete course path", async () => {
  assert.equal(existsSync(seedUrl), true, "reviewed SAS Chemistry Core Option seed must exist before release");
  const seed = await readFile(seedUrl, "utf8");
  for (const code of [
    "01:160:161", "01:160:162", "01:160:163", "01:160:164", "01:160:171", "01:160:251",
    "01:160:307", "01:160:308", "01:160:315", "01:160:316", "01:160:309", "01:160:310",
    "01:160:327", "01:160:328", "01:160:341", "01:160:342", "01:160:329", "01:160:348",
    "01:160:351", "01:160:352", "01:160:353", "01:160:491", "01:160:492",
    "01:640:151", "01:640:152", "01:640:250", "01:640:251", "01:640:252",
    "01:750:203", "01:750:204", "01:750:205", "01:750:206",
  ]) assert.match(seed, new RegExp(`'${code}'`));
  assert.match(seed, /'sasnb-chemistry-core-ba'/);
  assert.match(seed, /'160'/);
  assert.match(seed, /'sasnb-chemistry-160'/);
  assert.equal((seed.match(/'one_of'/g) || []).length, 5);
  assert.match(seed, /01:160:327.*01:160:328/s);
  assert.match(seed, /01:160:341.*01:160:342/s);
  assert.match(seed, /program_requirement_evidence/);
});
