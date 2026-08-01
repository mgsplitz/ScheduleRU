import type {
  CatalogDirectorySource,
  CatalogIdentityOverride,
  CatalogSourceBundle,
  CatalogSourceValidationIssue,
} from "./model.ts";
import { validateCatalogSourceBundle } from "./validation.ts";

type Row = Record<string, unknown>;

export interface CatalogSourceReadPreparedStatement {
  bind(...values: unknown[]): CatalogSourceReadPreparedStatement;
  all<T = Row>(): Promise<{ results?: T[] } | T[]>;
}

export interface CatalogSourceReadDatabase {
  prepare(sql: string): CatalogSourceReadPreparedStatement;
}

export class CatalogSourceExportValidationError extends TypeError {
  readonly issues: CatalogSourceValidationIssue[];

  constructor(issues: CatalogSourceValidationIssue[]) {
    super(
      issues
        .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
        .join("; "),
    );
    this.name = "CatalogSourceExportValidationError";
    this.issues = issues;
  }
}

async function allRows(
  database: CatalogSourceReadDatabase,
  sql: string,
): Promise<Row[]> {
  const result = await database.prepare(sql).bind().all<Row>();
  return Array.isArray(result)
    ? result
    : (Array.isArray(result.results) ? result.results : []);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseLabels(value: unknown, path: string): string[] {
  if (typeof value !== "string") {
    throw new TypeError(`${path}: invalid JSON`);
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed as string[];
  } catch {
    throw new TypeError(`${path}: invalid JSON`);
  }
}

export async function exportCatalogSourceBundle(
  database: CatalogSourceReadDatabase,
): Promise<CatalogSourceBundle> {
  const [sourceRows, overrideRows] = await Promise.all([
    allRows(
      database,
      `/* catalog-sources-export:sources */
       SELECT id, school_slug, directory_url, profile_path, catalog_year,
              source_title, adapter, enabled, owner_labels_json
       FROM program_catalog_sources
       ORDER BY id`,
    ),
    allRows(
      database,
      `/* catalog-sources-export:overrides */
       SELECT catalog_source_id, program_slug, type, program_id
       FROM program_catalog_identity_overrides
       ORDER BY catalog_source_id, program_slug, type`,
    ),
  ]);

  const bySource = new Map<string, CatalogIdentityOverride[]>();
  for (const row of overrideRows) {
    const sourceId = stringValue(row.catalog_source_id);
    const overrides = bySource.get(sourceId) ?? [];
    overrides.push({
      program_slug: stringValue(row.program_slug),
      type: stringValue(row.type) as CatalogIdentityOverride["type"],
      program_id: stringValue(row.program_id),
    });
    bySource.set(sourceId, overrides);
  }

  const sources: CatalogDirectorySource[] = sourceRows.map((row, index) => {
    const id = stringValue(row.id);
    const identityOverrides = bySource.get(id) ?? [];
    bySource.delete(id);
    return {
      id,
      school_slug: stringValue(row.school_slug),
      directory_url: stringValue(row.directory_url),
      profile_path: stringValue(row.profile_path),
      catalog_year: nullableString(row.catalog_year),
      source_title: stringValue(row.source_title),
      adapter: stringValue(row.adapter) as CatalogDirectorySource["adapter"],
      enabled: Number(row.enabled) === 1,
      owner_labels: parseLabels(
        row.owner_labels_json,
        `sources[${index}].owner_labels_json`,
      ),
      identity_overrides: identityOverrides,
    };
  });

  if (bySource.size > 0) {
    throw new TypeError(
      `orphan identity override for source ${[...bySource.keys()].sort()[0]}`,
    );
  }

  const bundle: CatalogSourceBundle = { contract_version: 1, sources };
  const result = validateCatalogSourceBundle(bundle);
  if (!result.ok) throw new CatalogSourceExportValidationError(result.issues);
  return result.value;
}
