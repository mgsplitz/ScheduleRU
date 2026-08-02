import assert from "node:assert/strict";
import test from "node:test";

import {
  handleProgramAdminRoute,
} from "../../apps/api/src/programs/admin-routes.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("the program admin router ignores routes outside its ownership boundary", async () => {
  const response = await handleProgramAdminRoute({
    request: new Request("https://example.test/api/courses"),
    env: {},
    ctx: {},
    path: "/api/courses",
    url: new URL("https://example.test/api/courses"),
    json,
    checkAdmin: () => {
      throw new Error("authentication must not run for unrelated routes");
    },
    services: {},
  });
  assert.equal(response, null);
});

test("the program admin router authenticates before invoking contributor services", async () => {
  const url = new URL("https://example.test/api/admin/program-catalog/import?source=sas");
  const response = await handleProgramAdminRoute({
    request: new Request(url, { method: "POST" }),
    env: {},
    ctx: {},
    path: url.pathname,
    url,
    json,
    checkAdmin: () => false,
    services: new Proxy({}, {
      get() {
        throw new Error("services must not run before authentication");
      },
    }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "bad secret" });
});
