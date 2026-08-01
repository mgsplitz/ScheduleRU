export const CATALOG_SOURCE_ADAPTERS = [
  "html_program_directory_v1",
] as const;

export const CATALOG_PROGRAM_TYPES = ["major", "minor"] as const;

export type CatalogSourceAdapter = (typeof CATALOG_SOURCE_ADAPTERS)[number];
export type CatalogProgramType = (typeof CATALOG_PROGRAM_TYPES)[number];

export interface CatalogIdentityOverride {
  program_slug: string;
  type: CatalogProgramType;
  program_id: string;
}

export interface CatalogDirectorySource {
  id: string;
  school_slug: string;
  directory_url: string;
  profile_path: string;
  catalog_year: string | null;
  source_title: string;
  adapter: CatalogSourceAdapter;
  enabled: boolean;
  owner_labels: string[];
  identity_overrides: CatalogIdentityOverride[];
}

export interface CatalogSourceBundle {
  contract_version: 1;
  sources: CatalogDirectorySource[];
}

export interface CatalogSourceValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type CatalogSourceValidationResult =
  | { ok: true; value: CatalogSourceBundle; issues: [] }
  | { ok: false; issues: CatalogSourceValidationIssue[] };
