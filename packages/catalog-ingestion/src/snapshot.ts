import type { CatalogReviewBacklog } from "./model.ts";
import { assertCatalogReviewBacklog } from "./validation.ts";

export interface CatalogReviewBacklogSnapshotManifest {
  format_version: 1;
  generated_at: number;
  note_count: number;
  sha256: string;
}

function ordered(value: CatalogReviewBacklog): CatalogReviewBacklog {
  return {
    contract_version: 1,
    review_notes: [...value.review_notes].sort((left, right) =>
      JSON.stringify([
        left.program_id,
        left.section_name,
        left.raw_text,
      ]).localeCompare(JSON.stringify([
        right.program_id,
        right.section_name,
        right.raw_text,
      ]))
    ),
  };
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

export async function serializeCatalogReviewBacklogSnapshot(
  value: unknown,
  options: { generated_at: number },
) {
  if (!Number.isFinite(options.generated_at) || options.generated_at < 0) {
    throw new TypeError("generated_at must be a non-negative timestamp");
  }
  const backlog = ordered(assertCatalogReviewBacklog(value));
  const json = `${JSON.stringify(backlog, null, 2)}\n`;
  return {
    json,
    manifest: {
      format_version: 1 as const,
      generated_at: options.generated_at,
      note_count: backlog.review_notes.length,
      sha256: await sha256(json),
    },
  };
}

export async function parseCatalogReviewBacklogSnapshot(
  json: string,
  manifest: CatalogReviewBacklogSnapshotManifest,
): Promise<CatalogReviewBacklog> {
  if (
    manifest.format_version !== 1
    || !Number.isFinite(manifest.generated_at)
    || manifest.generated_at < 0
    || !Number.isInteger(manifest.note_count)
    || manifest.note_count < 0
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
  ) {
    throw new TypeError("invalid review-backlog snapshot manifest");
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
  const backlog = ordered(assertCatalogReviewBacklog(value));
  if (backlog.review_notes.length !== manifest.note_count) {
    throw new TypeError("snapshot contents do not match manifest inventory");
  }
  return backlog;
}
