import type { ReferenceDataBundle } from "@scheduleru/reference-data";

export interface ReferenceDataApiCapture {
  schools: unknown;
  programs: unknown;
  core_curricula: unknown;
  selection_policies: Record<string, unknown>;
  individual_requirements: Record<string, unknown>;
  batch_requirements: unknown[];
}

export interface ReferenceDataParityReport {
  ok: boolean;
  before_sha256: string;
  after_sha256: string;
  restored_rows: number;
  ignored_operational_fields: string[];
  differences: string[];
}

const OPERATIONAL_FIELDS = new Set(["auto_generated", "last_scraped_at"]);

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  const isOverlapException =
    "allowed_course_codes_json" in record
    && "program_a" in record
    && "program_b" in record;
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) =>
        !OPERATIONAL_FIELDS.has(key)
        && !(isOverlapException && key === "id")
      )
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, normalized(record[key])]),
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

function differences(
  before: unknown,
  after: unknown,
  path = "<root>",
  output: string[] = [],
): string[] {
  if (output.length >= 100 || Object.is(before, after)) return output;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) {
      output.push(`${path}.length: ${before.length} != ${after.length}`);
    }
    for (let index = 0; index < Math.min(before.length, after.length); index++) {
      differences(before[index], after[index], `${path}[${index}]`, output);
    }
    return output;
  }
  if (
    typeof before === "object"
    && before !== null
    && !Array.isArray(before)
    && typeof after === "object"
    && after !== null
    && !Array.isArray(after)
  ) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      if (!(key in left)) output.push(`${path}.${key}: added`);
      else if (!(key in right)) output.push(`${path}.${key}: removed`);
      else differences(left[key], right[key], `${path}.${key}`, output);
    }
    return output;
  }
  output.push(`${path}: ${JSON.stringify(before)} != ${JSON.stringify(after)}`);
  return output;
}

function endpoint(api: URL, path: string): URL {
  const base = api.pathname === "/" ? "" : api.pathname.replace(/\/+$/, "");
  return new URL(`${base}${path}`, api.origin);
}

async function jsonResponse(response: Response, label: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function arrayField(value: unknown, field: string): Array<Record<string, unknown>> {
  if (typeof value !== "object" || value === null) return [];
  const array = (value as Record<string, unknown>)[field];
  return Array.isArray(array)
    ? array.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    : [];
}

async function mapConcurrent<T, R>(
  values: T[],
  limit: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await operation(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return result;
}

export async function captureReferenceDataApi(
  api: URL,
  fetcher: typeof globalThis.fetch,
): Promise<ReferenceDataApiCapture> {
  const [schools, programs, coreCurricula] = await Promise.all([
    fetcher(endpoint(api, "/api/schools"))
      .then((response) => jsonResponse(response, "/api/schools")),
    fetcher(endpoint(api, "/api/programs"))
      .then((response) => jsonResponse(response, "/api/programs")),
    fetcher(endpoint(api, "/api/core-curricula"))
      .then((response) => jsonResponse(response, "/api/core-curricula")),
  ]);
  const schoolSlugs = arrayField(schools, "schools")
    .map((school) => String(school.slug || ""))
    .filter(Boolean)
    .sort();
  const programIds = [
    ...arrayField(programs, "programs"),
    ...arrayField(coreCurricula, "curricula"),
  ].map((program) => String(program.id || ""))
    .filter(Boolean)
    .sort();
  const policyValues = await mapConcurrent(schoolSlugs, 4, async (slug) => {
    const path =
      `/api/program-selection-policies?home_school=${encodeURIComponent(slug)}`;
    return jsonResponse(await fetcher(endpoint(api, path)), path);
  });
  const individualValues = await mapConcurrent(programIds, 8, async (id) => {
    const path = `/api/programs/${encodeURIComponent(id)}/requirements`;
    return jsonResponse(await fetcher(endpoint(api, path)), path);
  });
  const batches: string[][] = [];
  for (let offset = 0; offset < programIds.length; offset += 25) {
    batches.push(programIds.slice(offset, offset + 25));
  }
  const batchRequirements = await mapConcurrent(batches, 2, async (ids) => {
    const path = `/api/requirements?programs=${encodeURIComponent(ids.join(","))}`;
    return jsonResponse(await fetcher(endpoint(api, path)), path);
  });
  return {
    schools,
    programs,
    core_curricula: coreCurricula,
    selection_policies: Object.fromEntries(
      schoolSlugs.map((slug, index) => [slug, policyValues[index]]),
    ),
    individual_requirements: Object.fromEntries(
      programIds.map((id, index) => [id, individualValues[index]]),
    ),
    batch_requirements: batchRequirements,
  };
}

export async function compareReferenceDataCaptures(
  before: ReferenceDataApiCapture,
  after: ReferenceDataApiCapture,
  restoredRows: number,
): Promise<ReferenceDataParityReport> {
  const left = normalized(before);
  const right = normalized(after);
  const found = differences(left, right);
  return {
    ok: found.length === 0,
    before_sha256: await sha256(canonical(left)),
    after_sha256: await sha256(canonical(right)),
    restored_rows: restoredRows,
    ignored_operational_fields: [
      "double_count_exceptions.id",
      ...OPERATIONAL_FIELDS,
    ].sort(),
    differences: found,
  };
}

export async function roundTripReferenceData(
  api: URL,
  bundle: ReferenceDataBundle,
  secret: string,
  fetcher: typeof globalThis.fetch,
): Promise<ReferenceDataParityReport> {
  const before = await captureReferenceDataApi(api, fetcher);
  const response = await fetcher(endpoint(api, "/api/admin/reference-data"), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bundle),
  });
  await jsonResponse(response, "reference-data restore");
  const after = await captureReferenceDataApi(api, fetcher);
  const restoredRows = Object.values(bundle)
    .filter(Array.isArray)
    .reduce((sum, rows) => sum + rows.length, 0);
  return compareReferenceDataCaptures(before, after, restoredRows);
}
