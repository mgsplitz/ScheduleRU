import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seed = await readFile(
  new URL("../schema/seed_sas_ppe_draft.sql", import.meta.url),
  "utf8"
);
const inventory = await readFile(
  new URL("../../SAS_PILOT_SOURCE_INVENTORY.md", import.meta.url),
  "utf8"
);

const sources = [
  "https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics",
  "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/philosophy-politics-and-economics-ppe",
];

const courseCodes = [
  "01:730:107", "01:730:249", "01:730:250", "01:730:251", "01:730:255",
  "01:730:330", "01:730:341", "01:730:342", "01:730:343", "01:730:345",
  "01:730:347", "01:730:358", "01:730:371", "01:730:441", "01:730:442",
  "01:730:445", "01:730:450", "01:730:459", "01:730:470",
  "01:790:101", "01:790:365", "01:790:371", "01:790:372", "01:790:373",
  "01:790:374", "01:790:375", "01:790:376", "01:790:472", "01:790:473",
  "01:790:477",
  "01:790:305", "01:790:318", "01:790:319", "01:790:320", "01:790:322",
  "01:790:323", "01:790:330", "01:790:333", "01:790:334", "01:790:335",
  "01:790:338", "01:790:350", "01:790:355", "01:790:358", "01:790:360",
  "01:790:363", "01:790:364", "01:790:386", "01:790:401", "01:790:404",
  "01:220:102", "01:220:103",
  "01:220:120", "01:220:327", "01:220:331", "01:220:390", "01:220:395",
  "01:220:402", "01:220:417", "01:220:432", "01:220:460", "01:220:463",
  "01:220:482",
];

test("PPE remains an unreviewed Rutgers-New Brunswick draft until all automatic rules are source-complete", () => {
  assert.match(seed, /'sasnb-ppe-minor'/);
  assert.match(seed, /'792'/);
  assert.match(seed, /'sasnb'/);
  assert.match(seed, /'unreviewed'/);
  assert.match(seed, /requirement_evidence_required/);
  assert.equal((seed.match(/INSERT INTO programs/g) || []).length, 1);
  assert.doesNotMatch(seed, /review_status\s*=\s*'reviewed'/);
});

test("PPE draft transcribes only the 63 finite published requirement courses", () => {
  assert.equal(courseCodes.length, 63);
  for (const courseCode of courseCodes) {
    assert.match(seed, new RegExp(`'${courseCode}'`));
  }
  assert.doesNotMatch(seed, /\('sasnb-ppe-[^']+', '01:730:105'\)/);
  assert.doesNotMatch(seed, /\('sasnb-ppe-[^']+', '01:730:106'\)/);
});

test("PPE draft retains official source provenance and unreviewed evidence for every group and course", () => {
  for (const source of sources) {
    assert.match(seed, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Current department page; no catalog-year boundary stated\./);
  assert.match(seed, /source_catalog_year/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /'group'/);
  assert.match(seed, /'course'/);
});

test("PPE draft has no public-SAS or automatic-policy data", () => {
  assert.doesNotMatch(seed, /school_profiles/i);
  assert.doesNotMatch(seed, /political-science/i);
  assert.doesNotMatch(seed, /school_curriculum_modules|curriculum_modules/i);
  assert.doesNotMatch(seed, /requirement_group_conditions|allocation_family|max_uses/i);
  assert.doesNotMatch(seed, /review_status\s*=\s*'reviewed'/);
});

test("source inventory records the current-source boundary and every PPE blocker", () => {
  assert.match(inventory, /Current department page; no catalog-year boundary stated\./);
  assert.match(inventory, /01:730:105\/106/);
  assert.match(inventory, /case-by-case/i);
  assert.match(inventory, /cross-listed.*only one requirement/i);
  assert.match(inventory, /C or better/i);
  assert.match(inventory, /only one course in each field can come from transfer credit/i);
});
