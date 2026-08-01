import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  parseCatalogSourceSnapshot,
  serializeCatalogSourceSnapshot,
  validateCatalogSourceBundle,
  type CatalogSourceSnapshotManifest,
} from "@scheduleru/catalog-sources";

export interface CatalogSourceCliDependencies {
  environment: Record<string, string | undefined>;
  fetch: typeof globalThis.fetch;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  now: () => number;
}

const defaults: CatalogSourceCliDependencies = {
  environment: process.env,
  fetch: globalThis.fetch,
  stdout: console.log,
  stderr: console.error,
  now: Date.now,
};

function usage(stderr: (line: string) => void): number {
  stderr("usage: catalog-sources validate <bundle.json>");
  stderr("       catalog-sources snapshot --api <development-api-url> --output <snapshot.json>");
  stderr("       catalog-sources restore --api <development-api-url> --snapshot <snapshot.json> --manifest <manifest.json>");
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
  return new URL(`${base}/api/admin/catalog-sources`, api.origin);
}

function manifestPath(snapshotPath: string): string {
  return snapshotPath.endsWith(".json")
    ? `${snapshotPath.slice(0, -5)}.manifest.json`
    : `${snapshotPath}.manifest.json`;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function apiAndSecret(
  apiValue: string,
  dependencies: CatalogSourceCliDependencies,
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

async function apiRequest(
  api: URL,
  secret: string,
  dependencies: CatalogSourceCliDependencies,
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
    dependencies.stderr("catalog-source request failed");
    return { ok: false };
  }
  let value: unknown = null;
  try {
    value = await response.json();
  } catch {
    // Report status without echoing an upstream response body.
  }
  if (!response.ok) {
    dependencies.stderr(
      `catalog-source request failed: development API returned HTTP ${response.status}`,
    );
    return { ok: false };
  }
  return { ok: true, value };
}

async function snapshot(
  apiValue: string,
  output: string,
  dependencies: CatalogSourceCliDependencies,
): Promise<number> {
  const target = apiAndSecret(apiValue, dependencies);
  if (!target) return 1;
  const response = await apiRequest(target.api, target.secret, dependencies);
  if (
    !response.ok
    || typeof response.value !== "object"
    || response.value === null
    || !("bundle" in response.value)
  ) {
    if (response.ok) {
      dependencies.stderr("catalog-source snapshot received an invalid response");
    }
    return 1;
  }
  try {
    const value = await serializeCatalogSourceSnapshot(
      (response.value as { bundle: unknown }).bundle,
      { generated_at: dependencies.now() },
    );
    await writeFile(output, value.json);
    await writeFile(
      manifestPath(output),
      `${JSON.stringify(value.manifest, null, 2)}\n`,
    );
    dependencies.stdout(
      `snapshotted ${value.manifest.row_counts.sources} catalog sources`,
    );
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`could not write a valid catalog-source snapshot${detail}`);
    return 1;
  }
}

async function restore(
  apiValue: string,
  snapshotFile: string,
  manifestFile: string,
  dependencies: CatalogSourceCliDependencies,
): Promise<number> {
  const target = apiAndSecret(apiValue, dependencies);
  if (!target) return 1;
  let bundle;
  try {
    bundle = await parseCatalogSourceSnapshot(
      await readFile(snapshotFile, "utf8"),
      await readJson(manifestFile) as CatalogSourceSnapshotManifest,
    );
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`could not read a valid catalog-source snapshot${detail}`);
    return 1;
  }
  const response = await apiRequest(target.api, target.secret, dependencies, {
    method: "PUT",
    body: JSON.stringify(bundle),
  });
  if (!response.ok) return 1;
  dependencies.stdout("restored catalog-source configuration");
  return 0;
}

export async function runCatalogSourceCli(
  args: string[],
  overrides: Partial<CatalogSourceCliDependencies> = {},
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
    dependencies.stderr(`could not read a JSON catalog-source bundle: ${first}`);
    return 1;
  }
  const validation = validateCatalogSourceBundle(value);
  if (!validation.ok) {
    validation.issues.forEach((issue) =>
      dependencies.stderr(
        `${issue.path || "<root>"}: ${issue.message} [${issue.code}]`,
      )
    );
    return 1;
  }
  dependencies.stdout("valid catalog-source bundle");
  return 0;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  process.exitCode = await runCatalogSourceCli(process.argv.slice(2));
}
