export interface CatalogReviewNote {
  program_id: string;
  section_name: string | null;
  raw_text: string;
  resolved: boolean;
}

export interface CatalogReviewBacklog {
  contract_version: 1;
  review_notes: CatalogReviewNote[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: CatalogReviewBacklog; issues: [] }
  | { ok: false; issues: ValidationIssue[] };
