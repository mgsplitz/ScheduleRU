import assert from "node:assert/strict";
import test from "node:test";

import {
  compareCatalogCaptures,
  roundTripDevelopmentCatalog,
  type CatalogApiCapture,
} from "../src/parity.ts";

function capture(lastScrapedAt: number, name = "Example"): CatalogApiCapture {
  return {
    programs: {
      programs: [{
        id: "sasnb-example-minor",
        name,
        last_scraped_at: lastScrapedAt,
      }],
    },
    core_curricula: { curricula: [] },
    individual_requirements: {
      "sasnb-example-minor": {
        program: { id: "sasnb-example-minor", last_scraped_at: lastScrapedAt },
        requirements: [{
          id: "sasnb-example-minor-core",
          auto_generated: lastScrapedAt === 1 ? 1 : 0,
          courses: [],
        }],
      },
    },
    batch_requirements: [{ requirements: {} }],
  };
}

test("parity ignores only documented operational fields", async () => {
  const report = await compareCatalogCaptures(capture(1), capture(2), 49);
  assert.equal(report.ok, true);
  assert.equal(report.before_sha256, report.after_sha256);
  assert.deepEqual(report.ignored_operational_fields, [
    "auto_generated",
    "last_scraped_at",
  ]);

  const changed = await compareCatalogCaptures(
    capture(1),
    capture(2, "Changed"),
    49,
  );
  assert.equal(changed.ok, false);
  assert.match(changed.differences[0]!, /programs\.programs\[0\]\.name/);
});

test("parity compares stored JSON and legacy rule metadata semantically", async () => {
  const before = capture(1);
  const after = capture(2);
  const beforeRequirement = (
    before.individual_requirements["sasnb-example-minor"] as {
      requirements: Array<Record<string, unknown>>;
    }
  ).requirements[0]!;
  const afterRequirement = (
    after.individual_requirements["sasnb-example-minor"] as {
      requirements: Array<Record<string, unknown>>;
    }
  ).requirements[0]!;
  Object.assign(beforeRequirement, {
    rule: "max",
    source_credits: "0",
    course_selectors: [{
      selector_json: "{\"version\":1,\"kind\":\"course_codes\"}",
    }],
  });
  Object.assign(afterRequirement, {
    rule: "max_courses",
    source_credits: null,
    course_selectors: [{
      selector_json: "{\"kind\":\"course_codes\",\"version\":1}",
    }],
  });

  const report = await compareCatalogCaptures(before, after, 49);
  assert.equal(report.ok, true);
});

test("round trip captures public behavior before and after authenticated publication", async () => {
  let published = false;
  const requests: Request[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const path = new URL(request.url).pathname;
    if (request.method === "PUT") {
      published = true;
      return Response.json({ ok: true });
    }
    if (path === "/api/programs") {
      return Response.json(capture(published ? 2 : 1).programs);
    }
    if (path === "/api/core-curricula") {
      return Response.json({ curricula: [] });
    }
    if (path === "/api/requirements") {
      return Response.json({ requirements: {} });
    }
    return Response.json(
      capture(published ? 2 : 1).individual_requirements["sasnb-example-minor"],
    );
  };
  const definition = {
    contract_version: 1,
    program: { id: "sasnb-example-minor" },
  } as never;

  const report = await roundTripDevelopmentCatalog(
    new URL("http://127.0.0.1:8787"),
    [definition],
    "test-secret",
    fetcher,
  );

  assert.equal(report.ok, true);
  assert.equal(report.published_programs, 1);
  const put = requests.find((request) => request.method === "PUT");
  assert.ok(put);
  assert.equal(put.headers.get("Authorization"), "Bearer test-secret");
  assert.equal(
    requests.filter((request) => request.method === "GET").length,
    8,
  );
});
