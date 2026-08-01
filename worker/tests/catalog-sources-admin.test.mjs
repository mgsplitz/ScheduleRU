import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogSourceExportValidationError,
} from "../../packages/catalog-sources/src/index.ts";
import {
  handleCatalogSourcesAdminRequest,
} from "../src/catalog-sources-admin.js";

function bundle() {
  return { contract_version: 1, sources: [] };
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

test("ignores routes outside the catalog-source boundary", async () => {
  assert.equal(
    await handleCatalogSourcesAdminRequest(
      request("/api/admin/reference-data"),
      environment(),
    ),
    null,
  );
});

test("requires bearer authentication", async () => {
  const response = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources"),
    environment(),
  );
  assert.equal(response.status, 403);
});

test("exports only from development and returns validation diagnostics", async () => {
  const env = environment();
  const exported = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    env,
    { exportCatalogSourceBundle: async () => bundle() },
  );
  assert.equal(exported.status, 200);
  assert.deepEqual(await exported.json(), { bundle: bundle() });

  const issue = {
    path: "sources[0].owner_labels",
    code: "invalid_array",
    message: "must contain at least one owner label",
  };
  const invalid = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    env,
    {
      exportCatalogSourceBundle: async () => {
        throw new CatalogSourceExportValidationError([issue]);
      },
    },
  );
  assert.equal(invalid.status, 422);
  assert.deepEqual(await invalid.json(), { issues: [issue] });

  const production = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources", {
      headers: { Authorization: "Bearer test-secret" },
    }),
    environment({ ENVIRONMENT: "production" }),
  );
  assert.equal(production.status, 409);
});

test("validates without writes and publishes only to development", async () => {
  const env = environment();
  const validation = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources/validate", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(bundle()),
    }),
    env,
  );
  assert.equal(validation.status, 200);
  assert.equal(env.DB.batches.length, 0);

  let published = false;
  const restored = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(bundle()),
    }),
    env,
    {
      publishCatalogSourceBundle: async (database, value) => {
        assert.equal(database, env.DB);
        assert.deepEqual(value, bundle());
        published = true;
        return { statement_count: 0 };
      },
    },
  );
  assert.equal(restored.status, 200);
  assert.equal(published, true);

  const production = await handleCatalogSourcesAdminRequest(
    request("/api/admin/catalog-sources", {
      method: "PUT",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify(bundle()),
    }),
    environment({ ENVIRONMENT: "production" }),
  );
  assert.equal(production.status, 409);
});
