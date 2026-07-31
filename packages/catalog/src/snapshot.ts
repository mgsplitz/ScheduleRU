import type { ProgramDefinition } from "./model.ts";
import { validateProgramDefinition } from "./validation.ts";

export interface CatalogSnapshotManifest {
  format_version: 1;
  generated_at: number;
  definition_count: number;
  program_ids: string[];
  sha256: string;
}

export interface CatalogSnapshot {
  jsonl: string;
  manifest: CatalogSnapshotManifest;
}

export interface CatalogSnapshotOptions {
  generated_at: number;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalValue(record[key])]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertManifestShape(
  manifest: CatalogSnapshotManifest,
): void {
  if (
    manifest.format_version !== 1
    || !Number.isFinite(manifest.generated_at)
    || manifest.generated_at < 0
    || !Number.isInteger(manifest.definition_count)
    || manifest.definition_count < 0
    || !Array.isArray(manifest.program_ids)
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
  ) {
    throw new TypeError("invalid catalog snapshot manifest");
  }
}

function validateDefinitions(values: unknown[]): ProgramDefinition[] {
  const definitions: ProgramDefinition[] = [];
  const ids = new Set<string>();
  for (const [index, value] of values.entries()) {
    const result = validateProgramDefinition(value);
    if (!result.ok) {
      throw new TypeError(
        result.issues
          .map(
            (issue) =>
              `definitions[${index}].${issue.path} [${issue.code}]: ${issue.message}`,
          )
          .join("; "),
      );
    }
    const id = result.value.program.id;
    if (ids.has(id)) throw new TypeError(`duplicate program ID: ${id}`);
    ids.add(id);
    definitions.push(result.value);
  }
  return definitions.sort(
    (left, right) => left.program.id.localeCompare(right.program.id),
  );
}

export async function serializeCatalogSnapshot(
  values: unknown[],
  options: CatalogSnapshotOptions,
): Promise<CatalogSnapshot> {
  if (!Number.isFinite(options.generated_at) || options.generated_at < 0) {
    throw new TypeError("generated_at must be a non-negative timestamp");
  }
  const definitions = validateDefinitions(values);
  const jsonl = definitions.length === 0
    ? ""
    : `${definitions.map(canonicalJson).join("\n")}\n`;
  const programIds = definitions.map((definition) => definition.program.id);
  return {
    jsonl,
    manifest: {
      format_version: 1,
      generated_at: options.generated_at,
      definition_count: definitions.length,
      program_ids: programIds,
      sha256: await sha256(jsonl),
    },
  };
}

export async function parseCatalogSnapshot(
  jsonl: string,
  manifest: CatalogSnapshotManifest,
): Promise<ProgramDefinition[]> {
  assertManifestShape(manifest);
  if (await sha256(jsonl) !== manifest.sha256) {
    throw new TypeError("snapshot digest does not match manifest");
  }
  const lines = jsonl.split("\n").filter((line) => line.length > 0);
  const values = lines.map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      throw new TypeError(`snapshot line ${index + 1} is not valid JSON`);
    }
  });
  const definitions = validateDefinitions(values);
  const programIds = definitions.map((definition) => definition.program.id);
  if (
    manifest.definition_count !== definitions.length
    || JSON.stringify(manifest.program_ids) !== JSON.stringify(programIds)
  ) {
    throw new TypeError("snapshot contents do not match manifest inventory");
  }
  return definitions;
}
