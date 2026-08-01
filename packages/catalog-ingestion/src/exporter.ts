import type {
  CatalogReviewBacklog,
  CatalogReviewNote,
  ValidationIssue,
} from "./model.ts";
import { validateCatalogReviewBacklog } from "./validation.ts";

type Row = Record<string, unknown>;

export interface CatalogIngestionReadPreparedStatement {
  bind(...values: unknown[]): CatalogIngestionReadPreparedStatement;
  all<T = Row>(): Promise<{ results?: T[] } | T[]>;
}

export interface CatalogIngestionReadDatabase {
  prepare(sql: string): CatalogIngestionReadPreparedStatement;
}

export class CatalogIngestionExportValidationError extends TypeError {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(
      issues
        .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
        .join("; "),
    );
    this.name = "CatalogIngestionExportValidationError";
    this.issues = issues;
  }
}

export async function exportCatalogReviewBacklog(
  database: CatalogIngestionReadDatabase,
): Promise<CatalogReviewBacklog> {
  const result = await database.prepare(
    `/* catalog-ingestion-export:review-notes */
     SELECT program_id, section_name, raw_text, resolved
     FROM requirement_raw_notes
     ORDER BY program_id, section_name, raw_text`,
  ).bind().all<Row>();
  const rows = Array.isArray(result)
    ? result
    : (Array.isArray(result.results) ? result.results : []);
  const reviewNotes: CatalogReviewNote[] = rows.map((row) => ({
    program_id: typeof row.program_id === "string" ? row.program_id : "",
    section_name:
      typeof row.section_name === "string" && row.section_name.length > 0
        ? row.section_name
        : null,
    raw_text: typeof row.raw_text === "string" ? row.raw_text : "",
    resolved: Number(row.resolved) === 1,
  }));
  const value = {
    contract_version: 1,
    review_notes: reviewNotes,
  };
  const validation = validateCatalogReviewBacklog(value);
  if (!validation.ok) {
    throw new CatalogIngestionExportValidationError(validation.issues);
  }
  return validation.value;
}
