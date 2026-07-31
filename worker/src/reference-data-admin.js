import {
  ReferenceDataExportValidationError,
  exportReferenceDataBundle,
  publishReferenceDataBundle,
  validateReferenceDataBundle,
} from "../../packages/reference-data/src/index.ts";

const ROUTE_PREFIX = "/api/admin/reference-data";
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
  if (!expected) return false;
  return request.headers.get("Authorization") === `Bearer ${expected}`;
}

async function requestJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function handleReferenceDataAdminRequest(
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
      return json({ error: "reference-data export is development-only" }, 409);
    }
    try {
      const bundle = await (
        dependencies.exportReferenceDataBundle || exportReferenceDataBundle
      )(env.DB);
      return json({ bundle });
    } catch (error) {
      if (error instanceof ReferenceDataExportValidationError) {
        return json({ issues: error.issues }, 422);
      }
      return json({ error: "reference-data export failed" }, 500);
    }
  }

  const body = await requestJson(request);
  if (!body.ok) return json({ error: "invalid JSON body" }, 400);

  if (path === `${ROUTE_PREFIX}/validate`) {
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }
    const validation = validateReferenceDataBundle(body.value);
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
    return json({ error: "reference-data publication is development-only" }, 409);
  }
  const validation = validateReferenceDataBundle(body.value);
  if (!validation.ok) return json({ issues: validation.issues }, 422);
  try {
    const publication = await (
      dependencies.publishReferenceDataBundle || publishReferenceDataBundle
    )(env.DB, validation.value);
    return json({ ok: true, publication });
  } catch {
    return json({ error: "reference-data publication failed" }, 500);
  }
}
