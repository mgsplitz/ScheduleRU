import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

test("canonical eligibility returns reviewed rules and credit exclusions together", async () => {
  const statements = [];
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = { sql, values };
          statements.push(statement);
          return statement;
        },
      };
    },
    async batch(batch) {
      return batch.map(({ sql }) => {
        if (sql.includes("FROM course_eligibility_reviews")) return { results: [{
          course_code: "01:640:252",
          review_status: "reviewed",
          no_known_conditions: 0,
          source_url: "https://www.math.rutgers.edu/course",
          source_label: "Rutgers Mathematics",
          source_date: "2026-08-20",
        }] };
        if (sql.includes("FROM course_eligibility_conditions")) return { results: [{
          course_code: "01:640:252",
          condition_key: "calculus-and-linear-algebra",
          condition_type: "prerequisite_course",
          condition_value_json: JSON.stringify({ any_of_course_codes: ["01:640:251"] }),
          review_status: "reviewed",
          source_url: "https://www.math.rutgers.edu/course",
          source_label: "Rutgers Mathematics",
          source_date: "2026-08-20",
        }] };
        if (sql.includes("course_credit_exclusion_members")) return { results: [{
          course_code: "01:640:252",
          policy_key: "rutgers-nb-differential-equations-credit",
          max_courses: 1,
          note: "Credit for one course in this family.",
          source_url: "https://www.math.rutgers.edu/course",
          source_label: "Rutgers Mathematics",
          source_date: "2026-08-20",
        }] };
        return { results: [] };
      });
    },
  };

  const response = await worker.fetch(
    new Request("https://example.test/api/course-eligibility?codes=01%3A640%3A252"),
    { DB: database },
    {},
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.eligibility["01:640:252"].credit_exclusions, [{
    policy_key: "rutgers-nb-differential-equations-credit",
    max_courses: 1,
    note: "Credit for one course in this family.",
    source_url: "https://www.math.rutgers.edu/course",
    source_label: "Rutgers Mathematics",
    source_date: "2026-08-20",
  }]);
  assert.equal(
    statements.some(({ sql }) => sql.includes("course_credit_exclusion_members")),
    true,
  );
});
