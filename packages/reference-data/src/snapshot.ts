import type { ReferenceDataBundle } from "./model.ts";
import { assertReferenceDataBundle } from "./validation.ts";

const ARRAY_KEYS = [
  "school_profiles",
  "school_curriculum_modules",
  "program_selection_limits",
  "program_combination_policies",
  "double_count_rules",
  "double_count_exceptions",
  "requirement_course_equivalencies",
  "course_eligibility_reviews",
  "course_eligibility_conditions",
] as const;

export type ReferenceDataArrayKey = (typeof ARRAY_KEYS)[number];

export interface ReferenceDataSnapshotManifest {
  format_version: 1;
  generated_at: number;
  row_counts: Record<ReferenceDataArrayKey, number>;
  sha256: string;
}

export interface ReferenceDataSnapshot {
  json: string;
  manifest: ReferenceDataSnapshotManifest;
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

function counts(bundle: ReferenceDataBundle): Record<ReferenceDataArrayKey, number> {
  return Object.fromEntries(
    ARRAY_KEYS.map((key) => [key, bundle[key].length]),
  ) as Record<ReferenceDataArrayKey, number>;
}

export async function serializeReferenceDataSnapshot(
  value: unknown,
  options: { generated_at: number },
): Promise<ReferenceDataSnapshot> {
  if (!Number.isFinite(options.generated_at) || options.generated_at < 0) {
    throw new TypeError("generated_at must be a non-negative timestamp");
  }
  const validated = assertReferenceDataBundle(value);
  const canonical = canonicalValue(validated) as ReferenceDataBundle;
  const json = `${JSON.stringify(canonical, null, 2)}\n`;
  return {
    json,
    manifest: {
      format_version: 1,
      generated_at: options.generated_at,
      row_counts: counts(canonical),
      sha256: await sha256(json),
    },
  };
}

export async function parseReferenceDataSnapshot(
  json: string,
  manifest: ReferenceDataSnapshotManifest,
): Promise<ReferenceDataBundle> {
  if (
    manifest.format_version !== 1
    || !Number.isFinite(manifest.generated_at)
    || manifest.generated_at < 0
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
  ) {
    throw new TypeError("invalid reference-data snapshot manifest");
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
  const bundle = assertReferenceDataBundle(value);
  if (
    ARRAY_KEYS.some((key) =>
      !Number.isInteger(manifest.row_counts[key])
      || manifest.row_counts[key] !== bundle[key].length
    )
  ) {
    throw new TypeError("snapshot contents do not match manifest inventory");
  }
  return bundle;
}
