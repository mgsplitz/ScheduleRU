import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("../schema/review_sas_computer_science_ba.sql", import.meta.url);

test("the Computer Science BA seed retains its published core and designated elective constraints", async () => {
  assert.equal(existsSync(seedUrl), true, "reviewed SAS Computer Science BA seed must exist before release");
  const seed = await readFile(seedUrl, "utf8");
  const core = ["01:198:111", "01:198:112", "01:198:205", "01:198:206", "01:198:211", "01:198:344", "01:640:151", "01:640:152", "01:640:250"];
  const designatedElectives = [
    "01:198:210", "01:198:213", "01:198:214", "01:198:314", "01:198:323", "01:198:324", "01:198:334", "01:198:336", "01:198:352", "01:198:411", "01:198:415", "01:198:416", "01:198:417", "01:198:419", "01:198:424", "01:198:425", "01:198:428", "01:198:431", "01:198:437", "01:198:439", "01:198:440", "01:198:442", "01:198:443", "01:198:444", "01:198:445", "01:198:452", "01:198:460", "01:198:461", "01:198:462", "01:198:493", "01:198:494",
    "14:332:376", "14:332:423", "14:332:424", "14:332:443", "14:332:451", "14:332:452", "14:332:453", "14:332:456", "14:332:472", "01:640:338", "01:640:348", "01:640:354", "01:640:428", "01:640:454", "01:640:461", "01:730:315", "01:730:407", "01:730:408", "01:730:329", "01:730:424", "01:615:441", "01:960:384", "01:960:463", "01:960:476", "01:960:486",
  ];
  for (const code of [...core, ...designatedElectives]) assert.match(seed, new RegExp(`'${code}'`));
  assert.match(seed, /'sasnb-computer-science-ba'/);
  assert.match(seed, /'198'/);
  assert.match(seed, /'sasnb-computer-science-198'/);
  assert.match(seed, /'min_courses',\s*5/);
  assert.match(seed, /'min_courses',\s*3/);
  assert.match(seed, /'min_courses',\s*2/);
  assert.match(seed, /'max',\s*1/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /All CS electives required for the BA\/BS degree must be completed in the last 10 years/);
});
