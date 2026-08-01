import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const snapshot = JSON.parse(await readFile(
  new URL(
    "../../reference-data/snapshots/reviewed-reference-data.v1.json",
    import.meta.url,
  ),
  "utf8",
));
const schemaFiles = await readdir(new URL("../schema/", import.meta.url));

function review(courseCode) {
  return snapshot.course_eligibility_reviews.find(
    (row) => row.course_code === courseCode,
  );
}

function conditions(courseCode) {
  return snapshot.course_eligibility_conditions.filter(
    (row) => row.course_code === courseCode,
  );
}

test("reviewed eligibility is portable reference data, not content SQL", () => {
  assert.ok(!schemaFiles.includes("reviewed_course_prerequisites.sql"));
  assert.ok(!schemaFiles.includes("reviewed_college_writing_eligibility.sql"));
});

test("reviewed source records cover non-current-term prerequisite regressions", () => {
  assert.match(review("01:220:481").source_url, /economics\.rutgers\.edu/);
  assert.match(review("33:136:405").source_url, /business\.rutgers\.edu/);
});

test("Economics of Uncertainty keeps all three prerequisite groups as alternatives", () => {
  const byKey = Object.fromEntries(
    conditions("01:220:481").map((row) => [
      row.condition_key,
      row.condition_value.any_of_course_codes,
    ]),
  );
  assert.deepEqual(byKey["intermediate-microeconomic-analysis"], ["01:220:320"]);
  assert.deepEqual(byKey.statistics, ["01:960:211", "01:960:285"]);
  assert.deepEqual(byKey["calculus-ii"], ["01:640:136", "01:640:152"]);
});

test("Risk Modeling requires the reviewed RBS concentration prerequisite", () => {
  assert.deepEqual(
    conditions("33:136:405")[0].condition_value.any_of_course_codes,
    ["33:136:386"],
  );
});

test("College Writing has a source-backed placement review, not a false prerequisite", () => {
  const collegeWriting = review("01:355:101");
  assert.equal(collegeWriting.no_known_conditions, true);
  assert.match(collegeWriting.source_url, /sasundergrad\.rutgers\.edu/);
  assert.deepEqual(conditions("01:355:101"), []);
});
