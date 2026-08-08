import assert from "node:assert/strict";
import test from "node:test";
import "../../apps/web/src/backend-client.js";

const client = globalThis.ScheduleRUBackendClient;

test("site configuration separates production, branch, and local storage", () => {
  const storage = {
    getItem(key) {
      return key === "scheduleru_dev_backend_url" ? "https://override.example/" : null;
    },
  };

  assert.deepEqual(client.siteConfig({ hostname: "scheduleru-9fb.pages.dev" }), {
    defaultUrl: "https://rutgers-course-sync.housselllaura.workers.dev",
    initialUrl: "https://rutgers-course-sync.housselllaura.workers.dev",
    storageKey: "bait_backend_url",
  });
  assert.deepEqual(client.siteConfig({
    hostname: "feature.scheduleru-9fb.pages.dev",
    storage,
  }), {
    defaultUrl: "https://rutgers-course-sync-dev.housselllaura.workers.dev",
    initialUrl: "https://override.example/",
    storageKey: "scheduleru_dev_backend_url",
  });
  assert.equal(
    client.siteConfig({ hostname: "localhost" }).defaultUrl,
    "https://rutgers-course-sync-dev.housselllaura.workers.dev",
  );
});

test("backend URL persistence normalizes the value and tolerates unavailable storage", () => {
  const writes = [];
  assert.equal(client.saveUrl({
    storage: { setItem: (...args) => writes.push(args) },
    storageKey: "backend",
    value: " https://api.example/// ",
  }), "https://api.example");
  assert.deepEqual(writes, [["backend", "https://api.example"]]);
  assert.equal(client.saveUrl({
    storage: { setItem() { throw new Error("blocked"); } },
    storageKey: "backend",
    value: "https://api.example/",
  }), "https://api.example");
});

test("backend JSON requests preserve the public error contract", async () => {
  const calls = [];
  assert.deepEqual(await client.fetchJson({
    baseUrl: "https://api.example/",
    path: "/api/programs",
    options: { method: "GET" },
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, async text() { return "{\"programs\":[]}"; } };
    },
  }), { programs: [] });
  assert.deepEqual(calls, [["https://api.example/api/programs", { method: "GET" }]]);

  await assert.rejects(
    client.fetchJson({
      baseUrl: "https://api.example",
      path: "/broken",
      fetchImpl: async () => ({ ok: false, status: 503, async text() { return "unavailable"; } }),
    }),
    /HTTP 503 — unavailable/,
  );
  await assert.rejects(
    client.fetchJson({
      baseUrl: "https://api.example",
      path: "/html",
      fetchImpl: async () => ({ ok: true, async text() { return "<html>"; } }),
    }),
    /Response wasn't JSON/,
  );
  await assert.rejects(
    client.fetchJson({ baseUrl: "", path: "/api/programs", fetchImpl: async () => assert.fail() }),
    /No backend URL set/,
  );
});
