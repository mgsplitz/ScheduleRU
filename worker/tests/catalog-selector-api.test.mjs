import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

function catalogDb(results = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            async first() { return { n: results.length }; },
            async all() { return { results }; },
          };
        },
      };
    },
  };
}

test("catalog selector filtering happens in D1 before limit and offset", async () => {
  const db = catalogDb([{ id: "01:640:300:2026:9", school: "01", subject_code: "640", course_number: "300" }]);
  const selector = {
    version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["640"],
    course_number_min: 300, course_number_max: 499, exclude_course_codes: ["01:640:491"],
  };
  const request = new Request(`https://example.test/api/courses?selector=${encodeURIComponent(JSON.stringify([selector]))}&limit=25&offset=0`);
  const response = await worker.fetch(request, { DB: db }, {});

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).courses, [{ id: "01:640:300:2026:9", school: "01", subject_code: "640", course_number: "300", attributes: [] }]);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /FROM courses c WHERE/);
  assert.match(db.calls[0].sql, /CAST\(c\.course_number AS INTEGER\) BETWEEN \? AND \?/);
  assert.match(db.calls[0].sql, /NOT IN \(SELECT value FROM json_each\(\?\)\)/);
  assert.match(db.calls[1].sql, /LIMIT \? OFFSET \?$/);
  assert.deepEqual(db.calls[0].values, ["01", "640", 300, 499, '["01:640:491"]']);
  assert.deepEqual(db.calls[1].values, ["01", "640", 300, 499, '["01:640:491"]', 25, 0]);
});

test("catalog selector queries reject malformed rules before querying D1", async () => {
  const db = catalogDb();
  const request = new Request("https://example.test/api/courses?selector=%7Bbad-json");
  const response = await worker.fetch(request, { DB: db }, {});

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid course selector" });
  assert.equal(db.calls.length, 0);
});

test("large reviewed course-code pools use one JSON bind instead of exceeding D1 variables", async () => {
  const db = catalogDb();
  const includeCourseCodes = Array.from(
    { length: 120 },
    (_, index) => `01:198:${String(index + 1).padStart(3, "0")}`
  );
  const selector = {
    version: 1,
    kind: "course_codes",
    include_course_codes: includeCourseCodes,
    exclude_course_codes: [],
  };
  const request = new Request(
    `https://example.test/api/courses?selector=${encodeURIComponent(JSON.stringify([selector]))}&limit=25&offset=0`
  );
  const response = await worker.fetch(request, { DB: db }, {});

  assert.equal(response.status, 200);
  assert.match(db.calls[0].sql, /json_each\(\?\)/);
  assert.equal(db.calls[0].values.length, 1);
  assert.deepEqual(JSON.parse(db.calls[0].values[0]), includeCourseCodes);
  assert.deepEqual(db.calls[1].values.slice(-2), [25, 0]);
});

test("large subject-level exclusion pools also stay within D1 bind limits", async () => {
  const db = catalogDb();
  const excludeCourseCodes = Array.from(
    { length: 120 },
    (_, index) => `01:640:${String(index + 1).padStart(3, "0")}`
  );
  const selector = {
    version: 1,
    kind: "subject_level",
    school_codes: ["01"],
    subject_codes: ["640"],
    course_number_min: 100,
    course_number_max: 499,
    exclude_course_codes: excludeCourseCodes,
  };
  const request = new Request(
    `https://example.test/api/courses?selector=${encodeURIComponent(JSON.stringify([selector]))}&limit=25&offset=0`
  );
  const response = await worker.fetch(request, { DB: db }, {});

  assert.equal(response.status, 200);
  assert.match(db.calls[0].sql, /NOT IN \(SELECT value FROM json_each\(\?\)\)/);
  assert.equal(db.calls[0].values.length, 5);
  assert.deepEqual(JSON.parse(db.calls[0].values[4]), excludeCourseCodes);
});

test("catalog API composes course, section, Core, and requirement filters", async () => {
  const db = catalogDb([{
    id: "01:355:301:2026:9",
    school: "01",
    subject_code: "355",
    course_number: "301",
    credits: "3",
    attributes_json: '["WCr"]',
  }]);
  const selector = {
    version: 1,
    kind: "subject_level",
    school_codes: ["01"],
    subject_codes: ["355"],
    course_number_min: 200,
    course_number_max: 499,
  };
  const params = new URLSearchParams({
    search: "writing",
    subject: "355",
    levels: "300",
    credits: "3",
    availability: "open",
    core: "WCr",
    selector: JSON.stringify([selector]),
  });
  const response = await worker.fetch(
    new Request(`https://example.test/api/courses?${params}`),
    { DB: db },
    {},
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.courses[0].attributes, ["WCr"]);
  assert.equal("attributes_json" in payload.courses[0], false);
  assert.match(db.calls[0].sql, /CAST\(c\.course_number AS INTEGER\) BETWEEN \? AND \?/);
  assert.match(db.calls[0].sql, /CAST\(c\.credits AS REAL\) IN \(SELECT value FROM json_each\(\?\)\)/);
  assert.match(db.calls[0].sql, /EXISTS \(SELECT 1 FROM sections/);
  assert.match(db.calls[0].sql, /course_requirement_attributes/);
});
