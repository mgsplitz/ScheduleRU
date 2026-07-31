import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { validateProgramDefinition } from "@scheduleru/catalog";

export interface CatalogCliDependencies {
  environment: Record<string, string | undefined>;
  fetch: typeof globalThis.fetch;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const defaultDependencies: CatalogCliDependencies = {
  environment: process.env,
  fetch: globalThis.fetch,
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

function usage(stderr: (line: string) => void): number {
  stderr("usage: catalog validate <definition.json>");
  stderr("       catalog publish <definition.json> --api <development-api-url>");
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

export async function runCatalogCli(
  args: string[],
  overrides: Partial<CatalogCliDependencies> = {},
): Promise<number> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const [command, file, ...rest] = args;
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
