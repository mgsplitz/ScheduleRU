import {
  CATALOG_PROGRAM_TYPES,
  CATALOG_SOURCE_ADAPTERS,
  type CatalogSourceBundle,
  type CatalogSourceValidationIssue,
  type CatalogSourceValidationResult,
} from "./model.ts";

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9-]{1,119}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class Validator {
  readonly issues: CatalogSourceValidationIssue[] = [];

  issue(path: string, code: string, message: string): void {
    this.issues.push({ path, code, message });
  }

  identifier(value: unknown, path: string): value is string {
    if (typeof value === "string" && IDENTIFIER_RE.test(value)) return true;
    this.issue(path, "invalid_identifier", "must be a lowercase URL-safe identifier");
    return false;
  }

  string(value: unknown, path: string): value is string {
    if (typeof value === "string" && value.trim().length > 0) return true;
    this.issue(path, "invalid_string", "must be a non-empty string");
    return false;
  }

  sourceUrl(value: unknown, path: string): void {
    if (typeof value === "string") {
      try {
        const url = new URL(value);
        if (
          url.protocol === "https:"
          && !url.username
          && !url.password
          && !url.search
          && !url.hash
          && (url.hostname === "rutgers.edu" || url.hostname.endsWith(".rutgers.edu"))
        ) return;
      } catch {
        // Report one path-addressed validation issue below.
      }
    }
    this.issue(path, "invalid_source_url", "must be an official Rutgers HTTPS URL");
  }

  profilePath(value: unknown, path: string): void {
    if (
      typeof value === "string"
      && value.startsWith("/")
      && value.endsWith("/")
      && !value.includes("://")
      && !value.includes("?")
      && !value.includes("#")
      && !value.split("/").includes("..")
    ) return;
    this.issue(
      path,
      "invalid_profile_path",
      "must be a safe root-relative path ending in a slash",
    );
  }

  validate(value: Record<string, unknown>): void {
    if (value.contract_version !== 1) {
      this.issue("contract_version", "unsupported_contract", "must equal 1");
    }
    if (!Array.isArray(value.sources)) {
      this.issue("sources", "invalid_array", "must be an array");
      return;
    }

    const sourceIds = new Set<string>();
    value.sources.forEach((source, sourceIndex) => {
      const path = `sources[${sourceIndex}]`;
      if (!isRecord(source)) {
        this.issue(path, "invalid_object", "must be an object");
        return;
      }

      if (this.identifier(source.id, `${path}.id`)) {
        const id = String(source.id);
        if (sourceIds.has(id)) {
          this.issue(path, "duplicate_key", `duplicates source id ${id}`);
        }
        sourceIds.add(id);
      }
      this.identifier(source.school_slug, `${path}.school_slug`);
      this.sourceUrl(source.directory_url, `${path}.directory_url`);
      this.profilePath(source.profile_path, `${path}.profile_path`);
      if (source.catalog_year !== null) {
        this.string(source.catalog_year, `${path}.catalog_year`);
      }
      this.string(source.source_title, `${path}.source_title`);
      if (!CATALOG_SOURCE_ADAPTERS.includes(source.adapter as never)) {
        this.issue(`${path}.adapter`, "invalid_adapter", "must be a supported adapter");
      }
      if (typeof source.enabled !== "boolean") {
        this.issue(`${path}.enabled`, "invalid_boolean", "must be a boolean");
      }

      if (!Array.isArray(source.owner_labels) || source.owner_labels.length === 0) {
        this.issue(
          `${path}.owner_labels`,
          "invalid_array",
          "must contain at least one owner label",
        );
      } else {
        const labels = new Set<string>();
        source.owner_labels.forEach((label, index) => {
          const labelPath = `${path}.owner_labels[${index}]`;
          if (!this.string(label, labelPath)) return;
          const normalized = String(label).trim();
          if (labels.has(normalized)) {
            this.issue(labelPath, "duplicate_key", `duplicates owner label ${normalized}`);
          }
          labels.add(normalized);
        });
      }

      if (!Array.isArray(source.identity_overrides)) {
        this.issue(`${path}.identity_overrides`, "invalid_array", "must be an array");
        return;
      }
      const overrideKeys = new Set<string>();
      source.identity_overrides.forEach((override, overrideIndex) => {
        const overridePath = `${path}.identity_overrides[${overrideIndex}]`;
        if (!isRecord(override)) {
          this.issue(overridePath, "invalid_object", "must be an object");
          return;
        }
        const slugValid = this.identifier(
          override.program_slug,
          `${overridePath}.program_slug`,
        );
        if (!CATALOG_PROGRAM_TYPES.includes(override.type as never)) {
          this.issue(
            `${overridePath}.type`,
            "invalid_program_type",
            "must be major or minor",
          );
        }
        this.identifier(override.program_id, `${overridePath}.program_id`);
        if (slugValid && CATALOG_PROGRAM_TYPES.includes(override.type as never)) {
          const key = `${String(override.program_slug)}:${String(override.type)}`;
          if (overrideKeys.has(key)) {
            this.issue(overridePath, "duplicate_key", `duplicates override ${key}`);
          }
          overrideKeys.add(key);
        }
      });
    });
  }
}

export function validateCatalogSourceBundle(
  value: unknown,
): CatalogSourceValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{
        path: "",
        code: "invalid_object",
        message: "must be an object",
      }],
    };
  }
  const validator = new Validator();
  validator.validate(value);
  return validator.issues.length === 0
    ? { ok: true, value: value as unknown as CatalogSourceBundle, issues: [] }
    : { ok: false, issues: validator.issues };
}

export function assertCatalogSourceBundle(value: unknown): CatalogSourceBundle {
  const result = validateCatalogSourceBundle(value);
  if (result.ok) return result.value;
  throw new TypeError(
    result.issues
      .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
      .join("; "),
  );
}
