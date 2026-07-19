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
