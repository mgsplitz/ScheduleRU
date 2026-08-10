import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";
import { webApplicationSource as frontend } from "./helpers/web-source.mjs";

const schema = await readFile(new URL("../../migrations/schema_course_eligibility_conditions.sql", import.meta.url), "utf8");
const requirementTreeBuilder = await readFile(
  new URL("../../packages/requirements/src/requirement-tree-builder.js", import.meta.url),
  "utf8",
);

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
  assert.match(
    frontend,
    /<script src="packages\/planner\/src\/eligibility-logic\.js"><\/script>/,
  );
  assert.match(
    frontend,
    /<script src="packages\/planner\/src\/academic-progress-model\.js"><\/script>/,
  );
  assert.match(
    frontend,
    /<script src="packages\/planner\/src\/course-path-model\.js"><\/script>/,
  );
  assert.match(frontend, /<script src="apps\/web\/src\/planner-state-store\.js"><\/script>/);
  assert.match(frontend, /CURRENT_PLANNER_STATE_VERSION=ScheduleRUPlannerStateLogic\.STATE_VERSION/);
  assert.match(frontend, /ScheduleRUPlannerStateStore\.load\(/);
  assert.match(frontend, /ScheduleRUAcademicProgressModel\.create\(/);
  assert.match(frontend, /ScheduleRUCoursePathModel\.create\(/);
  assert.match(frontend, /function confirmedAcademicCreditEntries\(/);
  assert.match(frontend, /function apFulfillsRequirementCourse\(/);
  assert.match(frontend, /function plannedScheduleCreditEntries\(/);
  assert.match(frontend, /function courseEligibilityForTerm\(/);
  assert.match(frontend, /function loadCourseEligibilityForCodes\(/);
  assert.match(frontend, /courseEligibilityFetched:\{\}/);
  assert.match(frontend, /await loadCourseEligibilityForCodes\(\[record\.code\]\)/);
  assert.match(frontend, /function reviewedEligibilityForCourse\(/);
  assert.match(frontend, /function courseEligibilityNotice\(/);
  assert.match(frontend, /Planning eligibility/);
  assert.match(frontend, /eligibilityStatus:eligibility\.status/);
  assert.match(frontend, /courseEligibilityForTerm\(record,\{year:ST\.year,sem\}\)/);
  assert.match(
    requirementTreeBuilder,
    /eligibility:\s*row\.eligibility\s*\|\|\s*existing\?\.eligibility\s*\|\|\s*null/,
  );
});
