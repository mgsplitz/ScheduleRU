import {
  CatalogSourceExportValidationError,
  exportCatalogSourceBundle,
  publishCatalogSourceBundle,
  validateCatalogSourceBundle,
} from "../../../packages/catalog-sources/src/index.ts";

const ROUTE_PREFIX = "/api/admin/catalog-sources";
const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function hasBearerSecret(request, env) {
  const expected = String(env.ADMIN_SECRET || "");
  return Boolean(expected)
    && request.headers.get("Authorization") === `Bearer ${expected}`;
}

async function requestJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function handleCatalogSourcesAdminRequest(
  request,
  env,
  dependencies = {},
) {
  const path = new URL(request.url).pathname;
  if (path !== ROUTE_PREFIX && path !== `${ROUTE_PREFIX}/validate`) return null;
  if (!hasBearerSecret(request, env)) {
    return json({ error: "unauthorized" }, 403);
  }

  if (request.method === "GET" && path === ROUTE_PREFIX) {
    if (env.ENVIRONMENT !== "development") {
      return json({ error: "catalog-source export is development-only" }, 409);
    }
    try {
      const bundle = await (
        dependencies.exportCatalogSourceBundle || exportCatalogSourceBundle
      )(env.DB);
      return json({ bundle });
    } catch (error) {
      if (error instanceof CatalogSourceExportValidationError) {
        return json({ issues: error.issues }, 422);
      }
      return json({ error: "catalog-source export failed" }, 500);
    }
  }

  const body = await requestJson(request);
  if (!body.ok) return json({ error: "invalid JSON body" }, 400);
  if (path === `${ROUTE_PREFIX}/validate`) {
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }
    const validation = validateCatalogSourceBundle(body.value);
    if (!validation.ok) return json({ issues: validation.issues }, 422);
    return json({
      ok: true,
      contract_version: validation.value.contract_version,
    });
  }

  if (request.method !== "PUT") {
    return json({ error: "method not allowed" }, 405);
  }
  if (env.ENVIRONMENT !== "development") {
    return json({ error: "catalog-source publication is development-only" }, 409);
  }
  const validation = validateCatalogSourceBundle(body.value);
  if (!validation.ok) return json({ issues: validation.issues }, 422);
  try {
    const publication = await (
      dependencies.publishCatalogSourceBundle || publishCatalogSourceBundle
    )(env.DB, validation.value);
    return json({ ok: true, publication });
  } catch {
    return json({ error: "catalog-source publication failed" }, 500);
  }
}
