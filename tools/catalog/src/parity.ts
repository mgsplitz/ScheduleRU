import type { ProgramDefinition } from "@scheduleru/catalog";

const OPERATIONAL_FIELDS = new Set([
  "auto_generated",
  "last_scraped_at",
]);

export interface CatalogApiCapture {
  programs: unknown;
  core_curricula: unknown;
  individual_requirements: Record<string, unknown>;
  batch_requirements: unknown[];
}

export interface CatalogParityReport {
  ok: boolean;
  before_sha256: string;
  after_sha256: string;
  published_programs: number;
  ignored_operational_fields: string[];
  differences: string[];
}

const EMBEDDED_JSON_FIELDS = new Set([
  "condition_value_json",
  "selector_json",
]);

function normalized(value: unknown, field = ""): unknown {
  if (EMBEDDED_JSON_FIELDS.has(field) && typeof value === "string") {
    try {
      return normalized(JSON.parse(value) as unknown);
    } catch {
      return value;
    }
  }
  if (field === "rule" && value === "max") return "max_courses";
  if (field === "source_credits") {
    const credits = Number(value);
    return Number.isFinite(credits) && credits > 0 ? credits : null;
  }
  if (Array.isArray(value)) return value.map((item) => normalized(item));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => !OPERATIONAL_FIELDS.has(key))
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, normalized(record[key], key)]),
  );
}

function canonical(value: unknown): string {
  return JSON.stringify(normalized(value));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function differencePaths(
  before: unknown,
  after: unknown,
  path = "<root>",
  differences: string[] = [],
): string[] {
  if (differences.length >= 100) return differences;
  if (Object.is(before, after)) return differences;
  if (
    Array.isArray(before)
    && Array.isArray(after)
  ) {
    if (before.length !== after.length) {
      differences.push(`${path}.length: ${before.length} != ${after.length}`);
    }
    const length = Math.min(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      differencePaths(before[index], after[index], `${path}[${index}]`, differences);
    }
    return differences;
  }
  if (
    typeof before === "object"
    && before !== null
    && !Array.isArray(before)
    && typeof after === "object"
    && after !== null
    && !Array.isArray(after)
  ) {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = [...new Set([
      ...Object.keys(beforeRecord),
      ...Object.keys(afterRecord),
    ])].sort();
    for (const key of keys) {
      if (OPERATIONAL_FIELDS.has(key)) continue;
      if (!(key in beforeRecord)) {
        differences.push(`${path}.${key}: added`);
      } else if (!(key in afterRecord)) {
        differences.push(`${path}.${key}: removed`);
      } else {
        differencePaths(
          beforeRecord[key],
          afterRecord[key],
          path === "<root>" ? key : `${path}.${key}`,
          differences,
        );
      }
    }
    return differences;
  }
  differences.push(
    `${path}: ${JSON.stringify(before)} != ${JSON.stringify(after)}`,
  );
  return differences;
}

function endpoint(api: URL, path: string): URL {
  const basePath = api.pathname === "/" ? "" : api.pathname.replace(/\/+$/, "");
  return new URL(`${basePath}${path}`, api.origin);
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

export async function captureCatalogApi(
  api: URL,
  programIds: string[],
  fetcher: typeof globalThis.fetch,
): Promise<CatalogApiCapture> {
  const orderedIds = [...new Set(programIds)].sort();
  const [programs, coreCurricula] = await Promise.all([
    fetcher(endpoint(api, "/api/programs")).then(
      (response) => responseJson(response, "/api/programs"),
    ),
    fetcher(endpoint(api, "/api/core-curricula")).then(
      (response) => responseJson(response, "/api/core-curricula"),
    ),
  ]);
  const individualValues = await mapWithConcurrency(
    orderedIds,
    8,
    async (programId) => {
      const path = `/api/programs/${encodeURIComponent(programId)}/requirements`;
      return responseJson(await fetcher(endpoint(api, path)), path);
    },
  );
  const individualRequirements = Object.fromEntries(
    orderedIds.map((programId, index) => [
      programId,
      individualValues[index],
    ]),
  );
  const batches: string[][] = [];
  for (let offset = 0; offset < orderedIds.length; offset += 25) {
    batches.push(orderedIds.slice(offset, offset + 25));
  }
  const batchRequirements = await mapWithConcurrency(
    batches,
    2,
    async (ids) => {
      const path = `/api/requirements?programs=${encodeURIComponent(ids.join(","))}`;
      return responseJson(await fetcher(endpoint(api, path)), path);
    },
  );
  return {
    programs,
    core_curricula: coreCurricula,
    individual_requirements: individualRequirements,
    batch_requirements: batchRequirements,
  };
}

export async function compareCatalogCaptures(
  before: CatalogApiCapture,
  after: CatalogApiCapture,
  publishedPrograms: number,
): Promise<CatalogParityReport> {
  const beforeCanonical = canonical(before);
  const afterCanonical = canonical(after);
  const differences = differencePaths(
    normalized(before),
    normalized(after),
  );
  return {
    ok: differences.length === 0,
    before_sha256: await sha256(beforeCanonical),
    after_sha256: await sha256(afterCanonical),
    published_programs: publishedPrograms,
    ignored_operational_fields: [...OPERATIONAL_FIELDS].sort(),
    differences,
  };
}

export async function roundTripDevelopmentCatalog(
  api: URL,
  definitions: ProgramDefinition[],
  secret: string,
  fetcher: typeof globalThis.fetch,
): Promise<CatalogParityReport> {
  const ordered = [...definitions].sort(
    (left, right) => left.program.id.localeCompare(right.program.id),
  );
  const programIds = ordered.map((definition) => definition.program.id);
  const before = await captureCatalogApi(api, programIds, fetcher);
  await publishDevelopmentCatalog(api, ordered, secret, fetcher);
  const after = await captureCatalogApi(api, programIds, fetcher);
  return compareCatalogCaptures(before, after, ordered.length);
}

export async function publishDevelopmentCatalog(
  api: URL,
  definitions: ProgramDefinition[],
  secret: string,
  fetcher: typeof globalThis.fetch,
): Promise<number> {
  const ordered = [...definitions].sort(
    (left, right) => left.program.id.localeCompare(right.program.id),
  );
  for (const definition of ordered) {
    const path = `/api/admin/catalog/program-definitions/${encodeURIComponent(definition.program.id)}`;
    const response = await fetcher(endpoint(api, path), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(definition),
    });
    await responseJson(response, `publish ${definition.program.id}`);
  }
  return ordered.length;
}
