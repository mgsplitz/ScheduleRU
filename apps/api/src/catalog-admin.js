import {
  CatalogExportValidationError,
  exportProgramDefinition,
  listReviewedProgramIds,
  publishProgramDefinition,
  validateProgramDefinition,
} from "../../../packages/catalog/src/index.ts";

const ROUTE_PREFIX = "/api/admin/catalog/program-definitions";
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
  const authorization = request.headers.get("Authorization") || "";
  return authorization === `Bearer ${expected}`;
}

async function requestJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function handleCatalogAdminRequest(
  request,
  env,
  dependencies = {},
) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (
    path !== ROUTE_PREFIX
    && path !== `${ROUTE_PREFIX}/validate`
    && !path.startsWith(`${ROUTE_PREFIX}/`)
  ) {
    return null;
  }

  if (!hasBearerSecret(request, env)) {
    return json({ error: "unauthorized" }, 403);
  }

  if (request.method === "GET") {
    if (env.ENVIRONMENT !== "development") {
      return json({ error: "catalog export is development-only" }, 409);
    }
    try {
      if (path === ROUTE_PREFIX) {
        const programIds = await (
          dependencies.listReviewedProgramIds || listReviewedProgramIds
        )(env.DB);
        return json({ program_ids: programIds });
      }
      const encodedProgramId = path.slice(`${ROUTE_PREFIX}/`.length);
      if (!encodedProgramId || encodedProgramId === "validate") {
        return json({ error: "not found" }, 404);
      }
      const programId = decodeURIComponent(encodedProgramId);
      const definition = await (
        dependencies.exportProgramDefinition || exportProgramDefinition
      )(env.DB, programId);
      return json({ definition });
    } catch (error) {
      if (error instanceof CatalogExportValidationError) {
        return json({ issues: error.issues }, 422);
      }
      if (
        error instanceof Error
        && error.message.startsWith("reviewed program not found:")
      ) {
        return json({ error: "reviewed program not found" }, 404);
      }
      return json({ error: "catalog export failed" }, 500);
    }
  }

  const body = await requestJson(request);
  if (!body.ok) return json({ error: "invalid JSON body" }, 400);

  if (path === `${ROUTE_PREFIX}/validate`) {
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }
    const validation = validateProgramDefinition(body.value);
    if (!validation.ok) return json({ issues: validation.issues }, 422);
    return json({
      ok: true,
      program_id: validation.value.program.id,
      contract_version: validation.value.contract_version,
    });
  }

  if (request.method !== "PUT") {
    return json({ error: "method not allowed" }, 405);
  }
  if (env.ENVIRONMENT !== "development") {
    return json({ error: "catalog publication is development-only" }, 409);
  }

  const validation = validateProgramDefinition(body.value);
  if (!validation.ok) return json({ issues: validation.issues }, 422);
  const pathProgramId = decodeURIComponent(path.slice(`${ROUTE_PREFIX}/`.length));
  if (pathProgramId !== validation.value.program.id) {
    return json({ error: "path program ID does not match definition" }, 409);
  }

  try {
    const publication = await publishProgramDefinition(env.DB, validation.value, {
      published_at: (dependencies.now || Date.now)(),
    });
    return json({ ok: true, publication });
  } catch {
    return json({ error: "catalog publication failed" }, 500);
  }
}
