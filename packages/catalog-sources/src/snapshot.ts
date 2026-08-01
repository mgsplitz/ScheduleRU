import type { CatalogSourceBundle } from "./model.ts";
import { assertCatalogSourceBundle } from "./validation.ts";

export interface CatalogSourceSnapshotManifest {
  format_version: 1;
  generated_at: number;
  row_counts: {
    sources: number;
    identity_overrides: number;
  };
  sha256: string;
}

export interface CatalogSourceSnapshot {
  json: string;
  manifest: CatalogSourceSnapshotManifest;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalValue)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right))
      );
  }
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalValue(record[key])]),
  );
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

function counts(bundle: CatalogSourceBundle): {
  sources: number;
  identity_overrides: number;
} {
  return {
    sources: bundle.sources.length,
    identity_overrides: bundle.sources.reduce(
      (total, source) => total + source.identity_overrides.length,
      0,
    ),
  };
}

export async function serializeCatalogSourceSnapshot(
  value: unknown,
  options: { generated_at: number },
): Promise<CatalogSourceSnapshot> {
  if (!Number.isFinite(options.generated_at) || options.generated_at < 0) {
    throw new TypeError("generated_at must be a non-negative timestamp");
  }
  const bundle = canonicalValue(
    assertCatalogSourceBundle(value),
  ) as CatalogSourceBundle;
  const json = `${JSON.stringify(bundle, null, 2)}\n`;
  return {
    json,
    manifest: {
      format_version: 1,
      generated_at: options.generated_at,
      row_counts: counts(bundle),
      sha256: await sha256(json),
    },
  };
}

export async function parseCatalogSourceSnapshot(
  json: string,
  manifest: CatalogSourceSnapshotManifest,
): Promise<CatalogSourceBundle> {
  if (
    manifest.format_version !== 1
    || !Number.isFinite(manifest.generated_at)
    || manifest.generated_at < 0
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
  ) {
    throw new TypeError("invalid catalog-source snapshot manifest");
  }
  if (await sha256(json) !== manifest.sha256) {
    throw new TypeError("snapshot digest does not match manifest");
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new TypeError("snapshot is not valid JSON");
  }
  const bundle = assertCatalogSourceBundle(value);
  const inventory = counts(bundle);
  if (
    manifest.row_counts.sources !== inventory.sources
    || manifest.row_counts.identity_overrides !== inventory.identity_overrides
  ) {
    throw new TypeError("snapshot contents do not match manifest inventory");
  }
  return bundle;
}
