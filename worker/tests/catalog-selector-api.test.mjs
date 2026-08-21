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

test("catalog exposes reviewed leaf Core attributes for the standard filter", async () => {
  const db = catalogDb([{ attribute_code: "AH" }, { attribute_code: "AHp" }, { attribute_code: "WCr" }]);
  const response = await worker.fetch(new Request("https://example.test/api/course-attributes"), { DB: db }, {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { attributes: ["AHp", "WCr"] });
  assert.match(db.calls[0].sql, /SELECT DISTINCT attribute_code/);
});

test("catalog resolves canonical metadata for a bounded set of course codes", async () => {
  const db = catalogDb([
    { course_code: "01:730:407", title: "Intermediate Logic I", credits: "3" },
    { course_code: "01:730:408", title: "Intermediate Logic II", credits: "3" },
  ]);
  const response = await worker.fetch(
    new Request("https://example.test/api/course-metadata?codes=01%3A730%3A407%2C01%3A730%3A408"),
    { DB: db },
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { courses: [
    { course_code: "01:730:407", title: "Intermediate Logic I", credits: "3" },
    { course_code: "01:730:408", title: "Intermediate Logic II", credits: "3" },
  ] });
  assert.match(db.calls[0].sql, /FROM course_reference/);
  assert.match(db.calls[0].sql, /catalog_prereqs/);
  assert.match(db.calls[0].sql, /catalog_restrictions/);
  assert.match(db.calls[0].sql, /source_url/);
  assert.match(db.calls[0].sql, /json_each\(\?\)/);
  assert.deepEqual(JSON.parse(db.calls[0].values[0]), ["01:730:407", "01:730:408"]);
});

test("catalog rejects malformed or oversized canonical metadata requests", async () => {
  const malformed = catalogDb();
  const malformedResponse = await worker.fetch(
    new Request("https://example.test/api/course-metadata?codes=01%3A730%3A407%2Cbad"),
    { DB: malformed },
    {},
  );
  assert.equal(malformedResponse.status, 400);
  assert.equal(malformed.calls.length, 0);

  const oversized = catalogDb();
  const codes = Array.from({ length: 101 }, (_, index) => `01:198:${String(index).padStart(3, "0")}`);
  const oversizedResponse = await worker.fetch(
    new Request(`https://example.test/api/course-metadata?codes=${encodeURIComponent(codes.join(","))}`),
    { DB: oversized },
    {},
  );
  assert.equal(oversizedResponse.status, 400);
  assert.equal(oversized.calls.length, 0);
});

test("development admins can seed canonical metadata from any Rutgers term without section writes", async () => {
  const calls = [];
  const batches = [];
  const db = {
    prepare(sql) {
      return { bind(...values) { const row = { sql, values }; calls.push(row); return row; } };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    {
      offeringUnitCode: "01", subject: "730", courseNumber: "407",
      expandedTitle: "Intermediate Logic I", credits: 3,
      preReqNotes: "01:730:201",
      sections: [{ sectionEligibility: "JUNIORS AND SENIORS" }],
    },
    { offeringUnitCode: "01", subject: "730", courseNumber: "408", expandedTitle: "Intermediate Logic II", credits: 3 },
  ]));
  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/admin/course-reference/sync?secret=secret&year=2024&term=9", { method: "POST" }),
      { DB: db, ADMIN_SECRET: "secret" },
      {},
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, year: 2024, term: "9", courses: 2 });
    assert.equal(batches.length, 1);
    assert.equal(calls.every((call) => call.sql.includes("course_reference")), true);
    assert.deepEqual(calls[0].values.slice(0, 3), ["01:730:407", "Intermediate Logic I", "3"]);
    assert.match(calls[0].sql, /catalog_prereqs/);
    assert.match(calls[0].sql, /catalog_restrictions/);
    assert.match(calls[0].sql, /source_year/);
    assert.match(calls[0].sql, /source_term/);
    assert.deepEqual(calls[0].values.slice(3, 7), [
      "01:730:201", "JUNIORS AND SENIORS", 2024, "9",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog selector filtering happens in D1 before limit and offset", async () => {
  const db = catalogDb([{ id: "01:640:300:2026:9", school: "01", subject_code: "640", course_number: "300" }]);
  const selector = {
    version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["640"],
    course_number_min: 300, course_number_max: 499, exclude_course_codes: ["01:640:491"],
  };
  const request = new Request(`https://example.test/api/courses?selector=${encodeURIComponent(JSON.stringify([selector]))}&limit=25&offset=0`);
  const response = await worker.fetch(request, { DB: db }, {});

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).courses, [{
    id: "01:640:300:2026:9",
    school: "01",
    subject_code: "640",
    course_number: "300",
    catalog_prereqs: "",
    catalog_restrictions: "",
    attributes: [],
    eligibility: null,
    prerequisitePaths: [],
    enforceablePrerequisitePaths: [],
    corequisitePaths: [],
    minimumPlanYear: null,
    minimumPriorCredits: null,
    creditExclusionFamilies: [],
    ruleCoverage: "catalog_parsed",
  }]);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /FROM courses c WHERE/);
  assert.match(db.calls[0].sql, /CAST\(c\.course_number AS INTEGER\) BETWEEN \? AND \?/);
  assert.match(db.calls[0].sql, /NOT IN \(SELECT value FROM json_each\(\?\)\)/);
  assert.match(db.calls[1].sql, /LIMIT \? OFFSET \?$/);
  assert.deepEqual(db.calls[0].values, ["01", "640", 300, 499, '["01:640:491"]']);
  assert.deepEqual(db.calls[1].values, ["01", "640", 300, 499, '["01:640:491"]', 25, 0]);
});

test("catalog candidates expose the same compiled prerequisite and standing facts as the planner", async () => {
  const db = catalogDb([{
    id: "33:390:440:2026:9",
    school: "33",
    subject_code: "390",
    course_number: "440",
    title: "ADV CORP FINANCE",
    canonical_prereqs: "33:390:400 CORPORATE FINANCE",
    canonical_restrictions: "FINANCE MAJORS ONLY; JUNIORS AND SENIORS",
    attributes_json: "[]",
  }]);
  const response = await worker.fetch(
    new Request("https://example.test/api/courses?limit=25&offset=0"),
    { DB: db },
    {},
  );

  assert.equal(response.status, 200);
  const [course] = (await response.json()).courses;
  assert.deepEqual(course.prerequisitePaths, [["33:390:400"]]);
  assert.deepEqual(course.enforceablePrerequisitePaths, [["33:390:400"]]);
  assert.equal(course.minimumPlanYear, 3);
  assert.equal(course.ruleCoverage, "catalog_parsed");
});

test("catalog search qualifies course columns when canonical metadata is joined", async () => {
  const db = catalogDb([]);
  const response = await worker.fetch(
    new Request("https://example.test/api/courses?search=advanced%20finance&limit=25&offset=0"),
    { DB: db, CURRENT_YEAR: "2026", CURRENT_TERM: "9" },
    {},
  );

  assert.equal(response.status, 200);
  assert.equal(db.calls.length, 2);
  assert.doesNotMatch(db.calls[0].sql, /LOWER\(title\)/);
  assert.doesNotMatch(db.calls[1].sql, /LOWER\(title\)/);
  assert.match(db.calls[0].sql, /LOWER\(c\.title\) LIKE \?/);
  assert.match(db.calls[1].sql, /LOWER\(c\.title\) LIKE \?/);
  assert.match(db.calls[1].sql, /ORDER BY c\.subject_code, c\.course_number/);
});

test("catalog and guided selectors use only the configured planning term", async () => {
  const db = catalogDb([]);
  const response = await worker.fetch(
    new Request("https://example.test/api/courses?limit=25&offset=0"),
    { DB: db, CURRENT_YEAR: "2026", CURRENT_TERM: "9" },
    {},
  );

  assert.equal(response.status, 200);
  assert.match(db.calls[0].sql, /c\.year = \? AND c\.term = \?/);
  assert.deepEqual(db.calls[0].values, [2026, "9"]);
  assert.deepEqual(db.calls[1].values, [2026, "9", 25, 0]);
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
