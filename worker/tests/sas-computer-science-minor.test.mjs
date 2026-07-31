import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_computer_science_minor.sql", import.meta.url);
const approvedCodes = [
  "111", "112", "205", "206", "210", "211", "213", "214", "314", "323", "324", "334", "336", "344", "345", "352",
  "411", "415", "416", "417", "419", "424", "425", "428", "431", "437", "439", "440", "442", "452", "460", "461", "462",
];

test("the Computer Science minor seed retains its published finite course list and upper-level constraint", async () => {
  assert.equal(
    existsSync(seedUrl),
    true,
    "reviewed SAS Computer Science minor seed must exist before it can be released"
  );

  const seed = await readFile(seedUrl, "utf8");
  for (const code of approvedCodes) {
    assert.match(seed, new RegExp(`'01:198:${code}'`));
  }
  assert.match(seed, /'sasnb-computer-science-minor'/);
  assert.match(seed, /'198'/);
  assert.match(seed, /'sasnb-computer-science-198'/);
  assert.match(seed, /'sasnb-computer-science-minor-approved-courses'/);
  assert.match(seed, /'sasnb-computer-science-minor-upper-level'/);
  assert.match(seed, /'min_courses', 6/);
  assert.match(seed, /'min_courses', 2/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /At least five of the courses used to satisfy the requirements of the minor must be courses taken in the New Brunswick Department of Computer Science/);
  assert.doesNotMatch(seed, /'01:198:105'/);
  assert.doesNotMatch(seed, /'01:198:107'/);
  assert.doesNotMatch(seed, /'01:198:110'/);
  assert.doesNotMatch(seed, /'01:198:170'/);
  assert.doesNotMatch(seed, /'01:198:405'/);
});
