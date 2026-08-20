import assert from "node:assert/strict";
import test from "node:test";

import {
  ReferenceDataExportValidationError,
} from "../../packages/reference-data/src/index.ts";
import {
  handleReferenceDataAdminRequest,
} from "../src/reference-data-admin.js";

function bundle() {
  return {
    contract_version: 1,
    school_profiles: [],
    school_curriculum_modules: [],
    program_selection_limits: [],
    program_combination_policies: [],
    double_count_rules: [],
    double_count_policies: [],
    double_count_exceptions: [],
    requirement_course_equivalencies: [],
    ap_equivalencies: [],
    course_eligibility_reviews: [],
    course_eligibility_conditions: [],
    course_credit_exclusion_policies: [],
    course_credit_exclusion_members: [],
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

test("ignores routes outside the reference-data boundary", async () => {
  assert.equal(
    await handleReferenceDataAdminRequest(
      request("/api/admin/catalog/program-definitions"),
      environment(),
    ),
    null,
  );
});

test("requires bearer authentication", async () => {
  const response = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data"),
    environment(),
  );
  assert.equal(response.status, 403);
});

test("exports the complete bundle only in development", async () => {
  const env = environment();
  const response = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    env,
    {
      exportReferenceDataBundle: async (database) => {
        assert.equal(database, env.DB);
        return bundle();
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { bundle: bundle() });

  const production = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    environment({ ENVIRONMENT: "production" }),
  );
  assert.equal(production.status, 409);
});

test("returns path-addressed export diagnostics", async () => {
  const issue = {
    path: "school_profiles[0].configuration",
    code: "invalid_object",
    message: "must be a decoded JSON object",
  };
  const response = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    environment(),
    {
      exportReferenceDataBundle: async () => {
        throw new ReferenceDataExportValidationError([issue]);
      },
    },
  );
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { issues: [issue] });
});

test("validates without writing and restores only in development", async () => {
  const env = environment();
  const validation = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data/validate", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(bundle()),
    }),
    env,
  );
  assert.equal(validation.status, 200);
  assert.equal(env.DB.batches.length, 0);

  let published = false;
  const restored = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(bundle()),
    }),
    env,
    {
      publishReferenceDataBundle: async (database, value) => {
        assert.equal(database, env.DB);
        assert.deepEqual(value, bundle());
        published = true;
        return { statement_count: 7 };
      },
    },
  );
  assert.equal(restored.status, 200);
  assert.equal(published, true);

  const production = await handleReferenceDataAdminRequest(
    request("/api/admin/reference-data", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(bundle()),
    }),
    environment({ ENVIRONMENT: "production" }),
  );
  assert.equal(production.status, 409);
});
