import type {
  CatalogReviewBacklog,
  ValidationIssue,
  ValidationResult,
} from "./model.ts";

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9-]{1,119}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCatalogReviewBacklog(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{
        path: "",
        code: "invalid_object",
        message: "review backlog must be an object",
      }],
    };
  }
  const issues: ValidationIssue[] = [];
  if (value.contract_version !== 1) {
    issues.push({
      path: "contract_version",
      code: "unsupported_contract_version",
      message: "must be version 1",
    });
  }
  if (!Array.isArray(value.review_notes)) {
    issues.push({
      path: "review_notes",
      code: "invalid_array",
      message: "must be an array",
    });
  } else {
    const keys = new Set<string>();
    value.review_notes.forEach((note, index) => {
      const path = `review_notes[${index}]`;
      if (!isRecord(note)) {
        issues.push({ path, code: "invalid_object", message: "must be an object" });
        return;
      }
      if (
        typeof note.program_id !== "string"
        || !IDENTIFIER_RE.test(note.program_id)
      ) {
        issues.push({
          path: `${path}.program_id`,
          code: "invalid_identifier",
          message: "must be a lowercase URL-safe identifier",
        });
      }
      if (
        note.section_name !== null
        && (typeof note.section_name !== "string"
          || note.section_name.trim().length === 0)
      ) {
        issues.push({
          path: `${path}.section_name`,
          code: "invalid_string",
          message: "must be a non-empty string or null",
        });
      }
      if (typeof note.raw_text !== "string" || note.raw_text.trim().length === 0) {
        issues.push({
          path: `${path}.raw_text`,
          code: "invalid_string",
          message: "must be a non-empty string",
        });
      }
      if (typeof note.resolved !== "boolean") {
        issues.push({
          path: `${path}.resolved`,
          code: "invalid_boolean",
          message: "must be a boolean",
        });
      }
      const key = JSON.stringify([
        note.program_id,
        note.section_name,
        note.raw_text,
      ]);
      if (keys.has(key)) {
        issues.push({
          path,
          code: "duplicate_note",
          message: "duplicates an existing review note",
        });
      }
      keys.add(key);
    });
  }
  return issues.length > 0
    ? { ok: false, issues }
    : {
      ok: true,
      value: value as unknown as CatalogReviewBacklog,
      issues: [],
    };
}

export function assertCatalogReviewBacklog(
  value: unknown,
): CatalogReviewBacklog {
  const result = validateCatalogReviewBacklog(value);
  if (!result.ok) {
    throw new TypeError(
      result.issues
        .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
        .join("; "),
    );
  }
  return result.value;
}
