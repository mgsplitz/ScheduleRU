import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const politicalScienceUrl = new URL("../schema/review_sas_political_science_minor.sql", import.meta.url);
const governmentBusinessUrl = new URL("../schema/review_sas_government_business_minor.sql", import.meta.url);
const historyUrl = new URL("../schema/review_sas_history_minor.sql", import.meta.url);

test("the Political Science minor seed retains the published 18-credit and upper-level requirements", async () => {
  assert.equal(existsSync(politicalScienceUrl), true, "reviewed Political Science minor seed must exist before release");
  const seed = await readFile(politicalScienceUrl, "utf8");
  assert.match(seed, /'sasnb-political-science-minor'/);
  assert.match(seed, /'790'/);
  assert.match(seed, /'sasnb-political-science-790'/);
  assert.match(seed, /'sasnb-political-science-minor-total'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-political-science-minor-upper'.*'min_courses',4/s);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /"01:790:395"/);
  assert.match(seed, /six credits of independent study, internships/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the Government and Business minor seed retains its fixed core and approved elective boundaries", async () => {
  assert.equal(existsSync(governmentBusinessUrl), true, "reviewed Government and Business minor seed must exist before release");
  const seed = await readFile(governmentBusinessUrl, "utf8");
  assert.match(seed, /'sasnb-government-business-minor'/);
  assert.match(seed, /'793'/);
  for (const code of ["01:790:101", "01:790:338"]) assert.equal(seed.includes(code), true, `required course ${code} must be retained`);
  assert.match(seed, /'sasnb-government-business-minor-electives'.*'min_courses',4/s);
  assert.match(seed, /'sasnb-government-business-minor-upper-electives'.*'min_courses',3/s);
  for (const code of ["01:790:102", "01:790:362", "01:790:488"]) assert.equal(seed.includes(code), true, `approved elective ${code} must be retained`);
  assert.match(seed, /'sasnb-government-business-no-political-science'/);
  assert.match(seed, /'sasnb-government-business-minor-no-political-science'/);
  assert.match(seed, /'selected_program_must_not_include_any'/);
  assert.match(seed, /program_requirement_evidence/);
});

test("the History minor seed covers all four published History subject codes and upper-level threshold", async () => {
  assert.equal(existsSync(historyUrl), true, "reviewed History minor seed must exist before release");
  const seed = await readFile(historyUrl, "utf8");
  assert.match(seed, /'sasnb-history-minor'/);
  assert.match(seed, /'510'/);
  assert.match(seed, /'sasnb-history-510'/);
  assert.match(seed, /'sasnb-history-minor-total'.*'min_courses',6/s);
  assert.match(seed, /'sasnb-history-minor-upper'.*'min_courses',3/s);
  assert.match(seed, /"subject_codes":\["506","508","510","512"\]/);
  assert.match(seed, /"course_number_min":300/);
  assert.match(seed, /two transfer courses/);
  assert.match(seed, /program_requirement_evidence/);
});
