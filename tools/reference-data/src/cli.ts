import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  parseReferenceDataSnapshot,
  serializeReferenceDataSnapshot,
  validateReferenceDataBundle,
  type ReferenceDataSnapshotManifest,
} from "@scheduleru/reference-data";

export interface ReferenceDataCliDependencies {
  environment: Record<string, string | undefined>;
  fetch: typeof globalThis.fetch;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  now: () => number;
}

const defaults: ReferenceDataCliDependencies = {
  environment: process.env,
  fetch: globalThis.fetch,
  stdout: console.log,
  stderr: console.error,
  now: Date.now,
};

function usage(stderr: (line: string) => void): number {
  stderr("usage: reference-data validate <bundle.json>");
  stderr("       reference-data snapshot --api <development-api-url> --output <snapshot.json>");
  stderr("       reference-data restore --api <development-api-url> --snapshot <snapshot.json> --manifest <manifest.json>");
  return 1;
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
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    && url.protocol === "http:";
  const remote =
    url.protocol === "https:"
    && (
      url.hostname.includes("-dev.")
      || url.hostname.startsWith("dev.")
      || url.hostname.endsWith(".dev.scheduleru-9fb.pages.dev")
    );
  if (!local && !remote) return null;
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function endpoint(api: URL): URL {
  const base = api.pathname === "/" ? "" : api.pathname;
  return new URL(`${base}/api/admin/reference-data`, api.origin);
}

function manifestPath(snapshotPath: string): string {
  return snapshotPath.endsWith(".json")
    ? `${snapshotPath.slice(0, -5)}.manifest.json`
    : `${snapshotPath}.manifest.json`;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function printIssues(
  value: unknown,
  stderr: (line: string) => void,
): ReturnType<typeof validateReferenceDataBundle> {
  const result = validateReferenceDataBundle(value);
  if (!result.ok) {
    result.issues.forEach((issue) =>
      stderr(`${issue.path || "<root>"}: ${issue.message} [${issue.code}]`)
    );
  }
  return result;
}

async function apiRequest(
  api: URL,
  secret: string,
  dependencies: ReferenceDataCliDependencies,
  init: RequestInit = {},
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  let response: Response;
  try {
    response = await dependencies.fetch(endpoint(api), {
      ...init,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    dependencies.stderr("reference-data request failed");
    return { ok: false };
  }
  let value: unknown = null;
  try {
    value = await response.json();
  } catch {
    // Report the HTTP status below without leaking an upstream body.
  }
  if (!response.ok) {
    dependencies.stderr(
      `reference-data request failed: development API returned HTTP ${response.status}`,
    );
    return { ok: false };
  }
  return { ok: true, value };
}

function apiAndSecret(
  apiValue: string,
  dependencies: ReferenceDataCliDependencies,
): { api: URL; secret: string } | null {
  const api = developmentApiUrl(apiValue);
  if (!api) {
    dependencies.stderr(
      "an HTTPS development API target is required (or localhost for testing)",
    );
    return null;
  }
  const secret = dependencies.environment.SCHEDULERU_ADMIN_SECRET;
  if (!secret) {
    dependencies.stderr("SCHEDULERU_ADMIN_SECRET must be set in the environment");
    return null;
  }
  return { api, secret };
}

async function snapshot(
  apiValue: string,
  output: string,
  dependencies: ReferenceDataCliDependencies,
): Promise<number> {
  const target = apiAndSecret(apiValue, dependencies);
  if (!target) return 1;
  const response = await apiRequest(
    target.api,
    target.secret,
    dependencies,
  );
  if (!response.ok) return 1;
  if (
    typeof response.value !== "object"
    || response.value === null
    || !("bundle" in response.value)
  ) {
    dependencies.stderr("reference-data snapshot received an invalid response");
    return 1;
  }
  try {
    const value = await serializeReferenceDataSnapshot(
      (response.value as { bundle: unknown }).bundle,
      { generated_at: dependencies.now() },
    );
    await writeFile(output, value.json);
    await writeFile(
      manifestPath(output),
      `${JSON.stringify(value.manifest, null, 2)}\n`,
    );
    const total = Object.values(value.manifest.row_counts)
      .reduce((sum, count) => sum + count, 0);
    dependencies.stdout(`snapshotted ${total} reference-data rows`);
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`could not write a valid reference-data snapshot${detail}`);
    return 1;
  }
}

async function loadSnapshot(
  snapshotFile: string,
  manifestFile: string,
  stderr: (line: string) => void,
) {
  try {
    return {
      ok: true as const,
      bundle: await parseReferenceDataSnapshot(
        await readFile(snapshotFile, "utf8"),
        await readJson(manifestFile) as ReferenceDataSnapshotManifest,
      ),
    };
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    stderr(`could not read a valid reference-data snapshot${detail}`);
    return { ok: false as const };
  }
}

async function restore(
  apiValue: string,
  snapshotFile: string,
  manifestFile: string,
  dependencies: ReferenceDataCliDependencies,
): Promise<number> {
  const target = apiAndSecret(apiValue, dependencies);
  if (!target) return 1;
  const loaded = await loadSnapshot(
    snapshotFile,
    manifestFile,
    dependencies.stderr,
  );
  if (!loaded.ok) return 1;
  const response = await apiRequest(
    target.api,
    target.secret,
    dependencies,
    { method: "PUT", body: JSON.stringify(loaded.bundle) },
  );
  if (!response.ok) return 1;
  dependencies.stdout("restored reference-data bundle");
  return 0;
}

export async function runReferenceDataCli(
  args: string[],
  overrides: Partial<ReferenceDataCliDependencies> = {},
): Promise<number> {
  const dependencies = { ...defaults, ...overrides };
  const [command, first, ...rest] = args;
  if (
    command === "snapshot"
    && first === "--api"
    && rest.length === 3
    && rest[1] === "--output"
    && rest[0]
    && rest[2]
  ) {
    return snapshot(rest[0], rest[2], dependencies);
  }
  if (
    command === "restore"
    && first === "--api"
    && rest.length === 5
    && rest[1] === "--snapshot"
    && rest[3] === "--manifest"
    && rest[0]
    && rest[2]
    && rest[4]
  ) {
    return restore(rest[0], rest[2], rest[4], dependencies);
  }
  if (command !== "validate" || !first || rest.length > 0) {
    return usage(dependencies.stderr);
  }
  let value: unknown;
  try {
    value = await readJson(first);
  } catch {
    dependencies.stderr(`could not read a JSON reference-data bundle: ${first}`);
    return 1;
  }
  const validation = printIssues(value, dependencies.stderr);
  if (!validation.ok) return 1;
  dependencies.stdout("valid reference-data bundle");
  return 0;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  process.exitCode = await runReferenceDataCli(process.argv.slice(2));
}
