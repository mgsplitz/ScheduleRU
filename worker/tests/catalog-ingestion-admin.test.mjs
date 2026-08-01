import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogIngestionExportValidationError,
} from "../../packages/catalog-ingestion/src/index.ts";
import {
  handleCatalogIngestionAdminRequest,
} from "../src/catalog-ingestion-admin.js";

function backlog() {
  return { contract_version: 1, review_notes: [] };
}

class Database {
  batches = [];
  prepare(sql) {
    return { bind: (...params) => ({ sql, params, bind: this.bind }) };
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
    DB: new Database(),
    ...overrides,
  };
}

function request(path, options = {}) {
  return new Request(`https://api.example.test${path}`, options);
}

test("ignores routes outside the catalog-ingestion boundary", async () => {
  assert.equal(
    await handleCatalogIngestionAdminRequest(
      request("/api/admin/reference-data"),
      environment(),
    ),
    null,
  );
});

test("requires bearer authentication", async () => {
  const response = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog"),
    environment(),
  );
  assert.equal(response.status, 403);
});

test("exports the backlog only in development", async () => {
  const env = environment();
  const response = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    env,
    {
      exportCatalogReviewBacklog: async (database) => {
        assert.equal(database, env.DB);
        return backlog();
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { backlog: backlog() });

  const production = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    environment({ ENVIRONMENT: "production" }),
  );
  assert.equal(production.status, 409);
});

test("returns structured diagnostics for malformed exported rows", async () => {
  const issue = {
    path: "review_notes[0].program_id",
    code: "invalid_identifier",
    message: "must be a lowercase URL-safe identifier",
  };
  const response = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    environment(),
    {
      exportCatalogReviewBacklog: async () => {
        throw new CatalogIngestionExportValidationError([issue]);
      },
    },
  );
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { issues: [issue] });
});

test("validates without writes and restores only in development", async () => {
  const env = environment();
  const validation = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog/validate", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(backlog()),
    }),
    env,
  );
  assert.equal(validation.status, 200);
  assert.equal(env.DB.batches.length, 0);

  let published = false;
  const restored = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(backlog()),
    }),
    env,
    {
      publishCatalogReviewBacklog: async (database, value) => {
        assert.equal(database, env.DB);
        assert.deepEqual(value, backlog());
        published = true;
        return { note_count: 0, statement_count: 1 };
      },
    },
  );
  assert.equal(restored.status, 200);
  assert.equal(published, true);

  const production = await handleCatalogIngestionAdminRequest(
    request("/api/admin/catalog-ingestion/review-backlog", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(backlog()),
    }),
    environment({ ENVIRONMENT: "production" }),
  );
  assert.equal(production.status, 409);
});
