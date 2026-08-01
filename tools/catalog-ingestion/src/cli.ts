import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  parseCatalogReviewBacklogSnapshot,
  serializeCatalogReviewBacklogSnapshot,
  validateCatalogReviewBacklog,
  type CatalogReviewBacklogSnapshotManifest,
} from "@scheduleru/catalog-ingestion";

export interface CatalogIngestionCliDependencies {
  environment: Record<string, string | undefined>;
  fetch: typeof globalThis.fetch;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  now: () => number;
}

const defaults: CatalogIngestionCliDependencies = {
  environment: process.env,
  fetch: globalThis.fetch,
  stdout: console.log,
  stderr: console.error,
  now: Date.now,
};

function developmentApi(value: string): URL | null {
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
  return new URL(
    `${base}/api/admin/catalog-ingestion/review-backlog`,
    api.origin,
  );
}

function manifestPath(snapshot: string): string {
  return snapshot.endsWith(".json")
    ? `${snapshot.slice(0, -5)}.manifest.json`
    : `${snapshot}.manifest.json`;
}

function target(
  apiValue: string,
  dependencies: CatalogIngestionCliDependencies,
) {
  const api = developmentApi(apiValue);
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

async function request(
  api: URL,
  secret: string,
  dependencies: CatalogIngestionCliDependencies,
  init: RequestInit = {},
) {
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
    dependencies.stderr("catalog-ingestion request failed");
    return { ok: false as const };
  }
  let value: unknown = null;
  try {
    value = await response.json();
  } catch {
    // The status is sufficient and avoids exposing arbitrary response text.
  }
  if (!response.ok) {
    dependencies.stderr(
      `catalog-ingestion request failed: development API returned HTTP ${response.status}`,
    );
    return { ok: false as const };
  }
  return { ok: true as const, value };
}

async function loadSnapshot(
  snapshotFile: string,
  manifestFile: string,
  stderr: (line: string) => void,
) {
  try {
    return {
      ok: true as const,
      backlog: await parseCatalogReviewBacklogSnapshot(
        await readFile(snapshotFile, "utf8"),
        JSON.parse(
          await readFile(manifestFile, "utf8"),
        ) as CatalogReviewBacklogSnapshotManifest,
      ),
    };
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    stderr(`could not read a valid review-backlog snapshot${detail}`);
    return { ok: false as const };
  }
}

async function snapshot(
  apiValue: string,
  output: string,
  dependencies: CatalogIngestionCliDependencies,
) {
  const value = target(apiValue, dependencies);
  if (!value) return 1;
  const response = await request(
    value.api,
    value.secret,
    dependencies,
  );
  if (
    !response.ok
    || typeof response.value !== "object"
    || response.value === null
    || !("backlog" in response.value)
  ) {
    if (response.ok) dependencies.stderr("invalid review-backlog response");
    return 1;
  }
  try {
    const result = await serializeCatalogReviewBacklogSnapshot(
      (response.value as { backlog: unknown }).backlog,
      { generated_at: dependencies.now() },
    );
    await writeFile(output, result.json);
    await writeFile(
      manifestPath(output),
      `${JSON.stringify(result.manifest, null, 2)}\n`,
    );
    dependencies.stdout(
      `snapshotted ${result.manifest.note_count} catalog review notes`,
    );
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`could not write review-backlog snapshot${detail}`);
    return 1;
  }
}

async function restore(
  apiValue: string,
  snapshotFile: string,
  manifestFile: string,
  dependencies: CatalogIngestionCliDependencies,
) {
  const value = target(apiValue, dependencies);
  if (!value) return 1;
  const loaded = await loadSnapshot(
    snapshotFile,
    manifestFile,
    dependencies.stderr,
  );
  if (!loaded.ok) return 1;
  const response = await request(
    value.api,
    value.secret,
    dependencies,
    { method: "PUT", body: JSON.stringify(loaded.backlog) },
  );
  if (!response.ok) return 1;
  dependencies.stdout(`restored ${loaded.backlog.review_notes.length} catalog review notes`);
  return 0;
}

function responseBacklog(value: unknown): unknown | null {
  return typeof value === "object"
      && value !== null
      && "backlog" in value
    ? (value as { backlog: unknown }).backlog
    : null;
}

async function roundTrip(
  apiValue: string,
  snapshotFile: string,
  manifestFile: string,
  reportFile: string,
  dependencies: CatalogIngestionCliDependencies,
) {
  const value = target(apiValue, dependencies);
  if (!value) return 1;
  const loaded = await loadSnapshot(
    snapshotFile,
    manifestFile,
    dependencies.stderr,
  );
  if (!loaded.ok) return 1;
  const beforeResponse = await request(
    value.api,
    value.secret,
    dependencies,
  );
  const beforeBacklog = beforeResponse.ok
    ? responseBacklog(beforeResponse.value)
    : null;
  if (beforeBacklog === null) {
    if (beforeResponse.ok) dependencies.stderr("invalid review-backlog response");
    return 1;
  }
  const restored = await request(
    value.api,
    value.secret,
    dependencies,
    { method: "PUT", body: JSON.stringify(loaded.backlog) },
  );
  if (!restored.ok) return 1;
  const afterResponse = await request(
    value.api,
    value.secret,
    dependencies,
  );
  const afterBacklog = afterResponse.ok
    ? responseBacklog(afterResponse.value)
    : null;
  if (afterBacklog === null) {
    if (afterResponse.ok) dependencies.stderr("invalid review-backlog response");
    return 1;
  }
  try {
    const before = await serializeCatalogReviewBacklogSnapshot(beforeBacklog, {
      generated_at: 0,
    });
    const after = await serializeCatalogReviewBacklogSnapshot(afterBacklog, {
      generated_at: 0,
    });
    const ok = before.manifest.sha256 === after.manifest.sha256;
    const report = {
      ok,
      before_sha256: before.manifest.sha256,
      after_sha256: after.manifest.sha256,
      restored_notes: loaded.backlog.review_notes.length,
      differences: ok ? [] : ["review_backlog: changed"],
    };
    await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    if (!ok) {
      dependencies.stderr("catalog-ingestion round trip changed review notes");
      return 1;
    }
    dependencies.stdout(
      `catalog-ingestion round trip preserved ${report.restored_notes} review notes`,
    );
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    dependencies.stderr(`catalog-ingestion round trip failed${detail}`);
    return 1;
  }
}

function usage(stderr: (line: string) => void): number {
  stderr("usage: catalog-ingestion validate <backlog.json>");
  stderr("       catalog-ingestion snapshot --api <development-api-url> --output <snapshot.json>");
  stderr("       catalog-ingestion restore --api <development-api-url> --snapshot <snapshot.json> --manifest <manifest.json>");
  stderr("       catalog-ingestion round-trip --api <development-api-url> --snapshot <snapshot.json> --manifest <manifest.json> --report <report.json>");
  return 1;
}

export async function runCatalogIngestionCli(
  args: string[],
  overrides: Partial<CatalogIngestionCliDependencies> = {},
): Promise<number> {
  const dependencies = { ...defaults, ...overrides };
  const [command, first, ...rest] = args;
  if (
    command === "round-trip"
    && first === "--api"
    && rest.length === 7
    && rest[1] === "--snapshot"
    && rest[3] === "--manifest"
    && rest[5] === "--report"
    && rest[0]
    && rest[2]
    && rest[4]
    && rest[6]
  ) return roundTrip(
    rest[0],
    rest[2],
    rest[4],
    rest[6],
    dependencies,
  );
  if (
    command === "snapshot"
    && first === "--api"
    && rest.length === 3
    && rest[1] === "--output"
    && rest[0]
    && rest[2]
  ) return snapshot(rest[0], rest[2], dependencies);
  if (
    command === "restore"
    && first === "--api"
    && rest.length === 5
    && rest[1] === "--snapshot"
    && rest[3] === "--manifest"
    && rest[0]
    && rest[2]
    && rest[4]
  ) return restore(rest[0], rest[2], rest[4], dependencies);
  if (command !== "validate" || !first || rest.length > 0) {
    return usage(dependencies.stderr);
  }
  try {
    const validation = validateCatalogReviewBacklog(
      JSON.parse(await readFile(first, "utf8")),
    );
    if (!validation.ok) {
      validation.issues.forEach((issue) =>
        dependencies.stderr(
          `${issue.path || "<root>"}: ${issue.message} [${issue.code}]`,
        )
      );
      return 1;
    }
    dependencies.stdout(
      `valid catalog review backlog: ${validation.value.review_notes.length} notes`,
    );
    return 0;
  } catch {
    dependencies.stderr(`could not read a JSON review backlog: ${first}`);
    return 1;
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  process.exitCode = await runCatalogIngestionCli(process.argv.slice(2));
}
