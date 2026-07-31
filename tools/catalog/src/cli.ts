import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  parseCatalogSnapshot,
  serializeCatalogSnapshot,
  type CatalogSnapshotManifest,
  validateProgramDefinition,
} from "@scheduleru/catalog";
import { roundTripDevelopmentCatalog } from "./parity.ts";

export interface CatalogCliDependencies {
  environment: Record<string, string | undefined>;
  fetch: typeof globalThis.fetch;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  now: () => number;
}

const defaultDependencies: CatalogCliDependencies = {
  environment: process.env,
  fetch: globalThis.fetch,
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
  now: Date.now,
};

function usage(stderr: (line: string) => void): number {
  stderr("usage: catalog validate <definition.json>");
  stderr("       catalog publish <definition.json> --api <development-api-url>");
  stderr("       catalog snapshot --api <development-api-url> --output <snapshot.jsonl>");
  stderr("       catalog round-trip --api <development-api-url> --snapshot <snapshot.jsonl> --manifest <manifest.json> --report <report.json>");
  return 1;
}

async function readDefinition(
  file: string,
  stderr: (line: string) => void,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: JSON.parse(await readFile(file, "utf8")) };
  } catch {
    stderr(`could not read a JSON catalog definition: ${file}`);
    return { ok: false };
  }
}

function developmentApiUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  const local =
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    && url.protocol === "http:";
  const deployedDevelopment =
    url.protocol === "https:"
    && (
      url.hostname.includes("-dev.")
      || url.hostname.startsWith("dev.")
      || url.hostname.endsWith(".dev.scheduleru-9fb.pages.dev")
    );
  if (!local && !deployedDevelopment) return null;
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function validationOutput(
  value: unknown,
  stderr: (line: string) => void,
) {
  const result = validateProgramDefinition(value);
  if (!result.ok) {
    for (const issue of result.issues) {
      stderr(`${issue.path || "<root>"}: ${issue.message} [${issue.code}]`);
    }
  }
  return result;
}

async function publishDefinition(
  definition: unknown,
  apiValue: string,
  dependencies: CatalogCliDependencies,
): Promise<number> {
  const validation = validationOutput(definition, dependencies.stderr);
  if (!validation.ok) return 1;

  const secret = dependencies.environment.SCHEDULERU_ADMIN_SECRET;
  if (!secret) {
    dependencies.stderr(
      "SCHEDULERU_ADMIN_SECRET must be set in the environment before publication",
    );
    return 1;
  }
  const api = developmentApiUrl(apiValue);
  if (!api) {
    dependencies.stderr(
      "publish requires an HTTPS development API target (or localhost for local testing)",
    );
    return 1;
  }
  const programId = validation.value.program.id;
  const basePath = api.pathname === "/" ? "" : api.pathname;
  const endpoint = new URL(
    `${basePath}/api/admin/catalog/program-definitions/${encodeURIComponent(programId)}`,
    api.origin,
  );
  let response: Response;
  try {
    response = await dependencies.fetch(endpoint, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.value),
    });
  } catch {
    dependencies.stderr("catalog publication request failed");
    return 1;
  }
  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }
  if (!response.ok) {
    const message =
      typeof responseBody === "object"
      && responseBody !== null
      && "error" in responseBody
      && typeof (responseBody as { error?: unknown }).error === "string"
        ? (responseBody as { error: string }).error
        : `development API returned HTTP ${response.status}`;
    dependencies.stderr(`catalog publication failed: ${message}`);
    return 1;
  }
  dependencies.stdout(`published catalog definition: ${programId}`);
  return 0;
}

function adminEndpoint(api: URL, suffix = ""): URL {
  const basePath = api.pathname === "/" ? "" : api.pathname;
  return new URL(
    `${basePath}/api/admin/catalog/program-definitions${suffix}`,
    api.origin,
  );
}

function snapshotManifestPath(output: string): string {
  return output.endsWith(".jsonl")
    ? `${output.slice(0, -".jsonl".length)}.manifest.json`
    : `${output}.manifest.json`;
}

async function authenticatedJson(
  endpoint: URL,
  secret: string,
  dependencies: CatalogCliDependencies,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  let response: Response;
  try {
    response = await dependencies.fetch(endpoint, {
      headers: { Authorization: `Bearer ${secret}` },
    });
  } catch {
    dependencies.stderr("catalog snapshot request failed");
    return { ok: false };
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = null;
  }
  if (!response.ok) {
    dependencies.stderr(`catalog snapshot failed: development API returned HTTP ${response.status}`);
    return { ok: false };
  }
  return { ok: true, value };
}

async function snapshotCatalog(
  apiValue: string,
  output: string,
  dependencies: CatalogCliDependencies,
): Promise<number> {
  const secret = dependencies.environment.SCHEDULERU_ADMIN_SECRET;
  if (!secret) {
    dependencies.stderr(
      "SCHEDULERU_ADMIN_SECRET must be set in the environment before export",
    );
    return 1;
  }
  const api = developmentApiUrl(apiValue);
  if (!api) {
    dependencies.stderr(
      "snapshot requires an HTTPS development API target (or localhost for local testing)",
    );
    return 1;
  }
  const inventory = await authenticatedJson(
    adminEndpoint(api),
    secret,
    dependencies,
  );
  if (!inventory.ok) return 1;
  const inventoryValue = inventory.value;
  const programIds =
    typeof inventoryValue === "object"
    && inventoryValue !== null
    && "program_ids" in inventoryValue
    && Array.isArray((inventoryValue as { program_ids?: unknown }).program_ids)
      ? (inventoryValue as { program_ids: unknown[] }).program_ids
      : null;
  if (
    !programIds
    || programIds.some((programId) => typeof programId !== "string")
  ) {
    dependencies.stderr("catalog snapshot failed: invalid reviewed-program inventory");
    return 1;
  }

  const definitions: unknown[] = [];
  for (const programId of programIds as string[]) {
    const exported = await authenticatedJson(
      adminEndpoint(api, `/${encodeURIComponent(programId)}`),
      secret,
      dependencies,
    );
    if (!exported.ok) return 1;
    if (
      typeof exported.value !== "object"
      || exported.value === null
      || !("definition" in exported.value)
    ) {
      dependencies.stderr(`catalog snapshot failed: invalid definition response for ${programId}`);
      return 1;
    }
    definitions.push((exported.value as { definition: unknown }).definition);
  }

  let snapshot;
  try {
    snapshot = await serializeCatalogSnapshot(definitions, {
      generated_at: dependencies.now(),
    });
    await writeFile(output, snapshot.jsonl);
    await writeFile(
      snapshotManifestPath(output),
      `${JSON.stringify(snapshot.manifest, null, 2)}\n`,
    );
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`could not write a valid catalog snapshot${detail}`);
    return 1;
  }
  const noun = snapshot.manifest.definition_count === 1
    ? "definition"
    : "definitions";
  dependencies.stdout(
    `snapshotted ${snapshot.manifest.definition_count} reviewed catalog ${noun}`,
  );
  return 0;
}

async function roundTripCatalog(
  apiValue: string,
  snapshotFile: string,
  manifestFile: string,
  reportFile: string,
  dependencies: CatalogCliDependencies,
): Promise<number> {
  const secret = dependencies.environment.SCHEDULERU_ADMIN_SECRET;
  if (!secret) {
    dependencies.stderr(
      "SCHEDULERU_ADMIN_SECRET must be set in the environment before round trip",
    );
    return 1;
  }
  const api = developmentApiUrl(apiValue);
  if (!api) {
    dependencies.stderr(
      "round-trip requires an HTTPS development API target (or localhost for local testing)",
    );
    return 1;
  }
  let definitions;
  try {
    const jsonl = await readFile(snapshotFile, "utf8");
    const manifest = JSON.parse(
      await readFile(manifestFile, "utf8"),
    ) as CatalogSnapshotManifest;
    definitions = await parseCatalogSnapshot(jsonl, manifest);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`could not read a valid catalog snapshot${detail}`);
    return 1;
  }
  let report;
  try {
    report = await roundTripDevelopmentCatalog(
      api,
      definitions,
      secret,
      dependencies.fetch,
    );
    await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`catalog round trip failed${detail}`);
    return 1;
  }
  if (!report.ok) {
    dependencies.stderr(
      `catalog round trip found ${report.differences.length} public API differences`,
    );
    return 1;
  }
  dependencies.stdout(
    `catalog round trip preserved public behavior for ${report.published_programs} programs`,
  );
  return 0;
}

export async function runCatalogCli(
  args: string[],
  overrides: Partial<CatalogCliDependencies> = {},
): Promise<number> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const [command, file, ...rest] = args;
  if (
    command === "snapshot"
    && file === "--api"
    && rest.length === 3
    && rest[1] === "--output"
    && rest[0]
    && rest[2]
  ) {
    return snapshotCatalog(rest[0], rest[2], dependencies);
  }
  if (
    command === "round-trip"
    && file === "--api"
    && rest.length === 7
    && rest[1] === "--snapshot"
    && rest[3] === "--manifest"
    && rest[5] === "--report"
    && rest[0]
    && rest[2]
    && rest[4]
    && rest[6]
  ) {
    return roundTripCatalog(
      rest[0],
      rest[2],
      rest[4],
      rest[6],
      dependencies,
    );
  }
  if (!command || !file) return usage(dependencies.stderr);
  const loaded = await readDefinition(file, dependencies.stderr);
  if (!loaded.ok) return 1;

  if (command === "validate" && rest.length === 0) {
    const validation = validationOutput(loaded.value, dependencies.stderr);
    if (!validation.ok) return 1;
    dependencies.stdout(
      `valid catalog definition: ${validation.value.program.id}`,
    );
    return 0;
  }

  if (
    command === "publish"
    && rest.length === 2
    && rest[0] === "--api"
    && rest[1]
  ) {
    return publishDefinition(loaded.value, rest[1], dependencies);
  }
  return usage(dependencies.stderr);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  process.exitCode = await runCatalogCli(process.argv.slice(2));
}
