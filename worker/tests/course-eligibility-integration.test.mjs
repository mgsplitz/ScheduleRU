import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../schema/schema_course_eligibility_conditions.sql", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/programs.js", import.meta.url), "utf8");

test("eligibility facts are source-backed and review-gated", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS course_eligibility_reviews/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS course_eligibility_conditions/);
  assert.match(schema, /CHECK \(review_status IN \('draft','reviewed','stale'\)\)/);
  assert.match(worker, /async function getReviewedCourseEligibility/);
  assert.match(worker, /WHERE review_status = 'reviewed'/);
  assert.match(worker, /path === "\/api\/course-eligibility"/);
});

test("course eligibility lookups stay within D1's 100-variable query limit", () => {
  assert.match(worker, /const COURSE_ELIGIBILITY_BATCH_SIZE = 100;/);
});

test("the browser migrates v1 state and evaluates the selected target term", async () => {
  const frontend = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(frontend, /<script src="eligibility-logic\.js"><\/script>/);
  assert.match(frontend, /const PLANNER_STATE_VERSION=2/);
  assert.match(frontend, /\[1,PLANNER_STATE_VERSION\]\.includes\(saved\.version\)/);
  assert.match(frontend, /ST\.creditLedger\s*=\s*savedObject\(saved\.creditLedger\)/);
  assert.match(frontend, /function confirmedAcademicCreditEntries\(/);
  assert.match(frontend, /function plannedScheduleCreditEntries\(/);
  assert.match(frontend, /function courseEligibilityForTerm\(/);
  assert.match(frontend, /function loadCourseEligibilityForCodes\(/);
  assert.match(frontend, /courseEligibilityFetched:\{\}/);
  assert.match(frontend, /await loadCourseEligibilityForCodes\(\[record\.code\]\)/);
  assert.match(frontend, /const eligibility=course\?\.eligibility\|\|ST\.courseEligibilityByCode\?\.\[course\?\.code\]\|\|null/);
  assert.match(frontend, /function reviewedEligibilityForCourse\(/);
  assert.match(frontend, /function courseEligibilityNotice\(/);
  assert.match(frontend, /Planning eligibility/);
  assert.match(frontend, /eligibilityStatus:eligibility\.status/);
  assert.match(frontend, /courseEligibilityForTerm\(record,\{year:ST\.year,sem\}\)/);
  assert.match(frontend, /eligibility:row\.eligibility\|\|existing\?\.eligibility\|\|null/);
});
