import {
  CatalogIngestionExportValidationError,
  exportCatalogReviewBacklog,
  publishCatalogReviewBacklog,
  validateCatalogReviewBacklog,
} from "../../packages/catalog-ingestion/src/index.ts";

const ROUTE = "/api/admin/catalog-ingestion/review-backlog";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: HEADERS });
}

function authorized(request, env) {
  const expected = String(env.ADMIN_SECRET || "");
  return expected
    && request.headers.get("Authorization") === `Bearer ${expected}`;
}

async function requestJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function handleCatalogIngestionAdminRequest(
  request,
  env,
  dependencies = {},
) {
  const path = new URL(request.url).pathname;
  if (path !== ROUTE && path !== `${ROUTE}/validate`) return null;
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 403);

  if (request.method === "GET" && path === ROUTE) {
    if (env.ENVIRONMENT !== "development") {
      return json({ error: "catalog-ingestion export is development-only" }, 409);
    }
    try {
      const backlog = await (
        dependencies.exportCatalogReviewBacklog || exportCatalogReviewBacklog
      )(env.DB);
      return json({ backlog });
    } catch (error) {
      if (error instanceof CatalogIngestionExportValidationError) {
        return json({ issues: error.issues }, 422);
      }
      return json({ error: "catalog-ingestion export failed" }, 500);
    }
  }

  const body = await requestJson(request);
  if (!body.ok) return json({ error: "invalid JSON body" }, 400);

  if (path === `${ROUTE}/validate`) {
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }
    const validation = validateCatalogReviewBacklog(body.value);
    if (!validation.ok) return json({ issues: validation.issues }, 422);
    return json({
      ok: true,
      contract_version: validation.value.contract_version,
      note_count: validation.value.review_notes.length,
    });
  }

  if (request.method !== "PUT") {
    return json({ error: "method not allowed" }, 405);
  }
  if (env.ENVIRONMENT !== "development") {
    return json(
      { error: "catalog-ingestion publication is development-only" },
      409,
    );
  }
  const validation = validateCatalogReviewBacklog(body.value);
  if (!validation.ok) return json({ issues: validation.issues }, 422);
  try {
    const publication = await (
      dependencies.publishCatalogReviewBacklog || publishCatalogReviewBacklog
    )(env.DB, validation.value);
    return json({ ok: true, publication });
  } catch {
    return json({ error: "catalog-ingestion publication failed" }, 500);
  }
}
