import assert from "node:assert/strict";
import test from "node:test";

import { handleCatalogAdminRequest } from "../src/catalog-admin.js";

function definition() {
  return {
    contract_version: 1,
    program: {
      id: "sasnb-example-minor",
      name: "Example Studies",
      school_slug: "sasnb",
      program_slug: "example-studies",
      type: "minor",
      catalog_year: "2026-2027",
      academic_program_code: "999",
      degree_type: null,
      program_family_id: "sasnb-example-999",
      source_url: "https://example.rutgers.edu/requirements",
      review_status: "reviewed",
      requirement_evidence_required: true,
    },
    sources: [{
      id: "requirements",
      url: "https://example.rutgers.edu/requirements",
      title: "Example requirements",
      catalog_year: "2026-2027",
      scope: "program_requirements",
      accessed_at: 1785456000000,
      note: "Official requirements.",
    }],
    requirement_groups: [{
      id: "sasnb-example-minor-core",
      parent_group_id: null,
      name: "Core",
      rule: "all",
      count: null,
      sort_order: 10,
      display_family: null,
      display_priority: 0,
      courses: [{
        code: "01:999:101",
        title: "Introduction",
        credits: 3,
        note: null,
        evidence: {
          source_id: "requirements",
          reviewer_note: "Required introduction.",
          review_status: "reviewed",
        },
      }],
      selectors: [],
      conditions: [],
      evidence: {
        source_id: "requirements",
        reviewer_note: "Official core.",
        review_status: "reviewed",
      },
    }],
    eligibility_rules: [],
  };
}

class FakeDatabase {
  batches = [];

  prepare(sql) {
    return {
      bind: (...params) => ({ sql, params, bind: this.bind }),
    };
  }

  async batch(statements) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true }));
  }
}

function environment(overrides = {}) {
  return {
    ADMIN_SECRET: "test-secret",
    ENVIRONMENT: "development",
    DB: new FakeDatabase(),
    ...overrides,
  };
}

function request(path, options = {}) {
  return new Request(`https://api.example.test${path}`, options);
}

async function body(response) {
  return response.json();
}

test("ignores routes outside the catalog-admin boundary", async () => {
  const response = await handleCatalogAdminRequest(
    request("/api/programs"),
    environment(),
  );
  assert.equal(response, null);
});

test("requires the existing admin secret through a bearer header", async () => {
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/validate", {
      method: "POST",
      body: JSON.stringify(definition()),
    }),
    environment(),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await body(response), { error: "unauthorized" });
});

test("exports reviewed definitions through development-only read routes", async () => {
  const env = environment();
  let exportedId = null;
  const dependencies = {
    listReviewedProgramIds: async (database) => {
      assert.equal(database, env.DB);
      return ["sasnb-example-minor"];
    },
    exportProgramDefinition: async (database, programId) => {
      assert.equal(database, env.DB);
      exportedId = programId;
      return definition();
    },
  };

  const listResponse = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    env,
    dependencies,
  );
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await body(listResponse), {
    program_ids: ["sasnb-example-minor"],
  });

  const definitionResponse = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/sasnb-example-minor", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    env,
    dependencies,
  );
  assert.equal(definitionResponse.status, 200);
  assert.deepEqual(await body(definitionResponse), { definition: definition() });
  assert.equal(exportedId, "sasnb-example-minor");
  assert.equal(env.DB.batches.length, 0);
});

test("blocks catalog exports outside the development Worker", async () => {
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    environment({ ENVIRONMENT: "production" }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await body(response), {
    error: "catalog export is development-only",
  });
});

test("validation returns path-addressed issues without writing", async () => {
  const env = environment();
  const value = definition();
  value.program.id = "unsafe/id";
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/validate", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    }),
    env,
  );

  assert.equal(response.status, 422);
  assert.equal((await body(response)).issues[0].path, "program.id");
  assert.equal(env.DB.batches.length, 0);
});

test("reports malformed JSON without exposing an exception", async () => {
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/validate", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
      body: "{",
    }),
    environment(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await body(response), { error: "invalid JSON body" });
});

test("blocks publication outside the development Worker", async () => {
  const env = environment({ ENVIRONMENT: "production" });
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/sasnb-example-minor", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(definition()),
    }),
    env,
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await body(response), {
    error: "catalog publication is development-only",
  });
  assert.equal(env.DB.batches.length, 0);
});

test("requires the path program ID to match the validated body", async () => {
  const env = environment();
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/sasnb-other-minor", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(definition()),
    }),
    env,
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await body(response), {
    error: "path program ID does not match definition",
  });
  assert.equal(env.DB.batches.length, 0);
});

test("publishes one validated program through the generic publisher", async () => {
  const env = environment();
  const response = await handleCatalogAdminRequest(
    request("/api/admin/catalog/program-definitions/sasnb-example-minor", {
      method: "PUT",
      headers: {
        Authorization: "Bearer test-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(definition()),
    }),
    env,
    { now: () => 1785456000000 },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), {
    ok: true,
    publication: {
      program_id: "sasnb-example-minor",
      sources: 1,
      groups: 1,
      courses: 1,
      selectors: 0,
      conditions: 0,
      evidence: 2,
      eligibility_rules: 0,
      statement_count: env.DB.batches[0].length,
      published_at: 1785456000000,
    },
  });
  assert.equal(env.DB.batches.length, 1);
});
