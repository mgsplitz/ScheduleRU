import assert from "node:assert/strict";
import test from "node:test";
import { requirementCourseEquivalencies } from "./helpers/reference-data-snapshot.mjs";

test("RBS systemic equivalencies are canonical reference data shared by every credit consumer", () => {
  assert.deepEqual(
    requirementCourseEquivalencies()
      .map(({
        program_id,
        requirement_course_code,
        equivalent_course_code,
        review_status,
      }) => ({
        program_id,
        requirement_course_code,
        equivalent_course_code,
        review_status,
      }))
      .sort((left, right) => (
        `${left.program_id}:${left.requirement_course_code}`.localeCompare(
          `${right.program_id}:${right.requirement_course_code}`,
        )
      )),
    [
      {
        program_id: "rbsnb-core-curriculum",
        requirement_course_code: "01:198:170",
        equivalent_course_code: "01:198:111",
        review_status: "reviewed",
      },
      {
        program_id: "rbsnb-core-curriculum",
        requirement_course_code: "01:960:285",
        equivalent_course_code: "01:960:211",
        review_status: "reviewed",
      },
      {
        program_id: "rbsnb-foundational-core",
        requirement_course_code: "01:198:170",
        equivalent_course_code: "01:198:111",
        review_status: "reviewed",
      },
      {
        program_id: "rbsnb-foundational-core",
        requirement_course_code: "01:960:285",
        equivalent_course_code: "01:960:211",
        review_status: "reviewed",
      },
    ],
  );
});
