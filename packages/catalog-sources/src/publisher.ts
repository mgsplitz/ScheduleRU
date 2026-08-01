import type { CatalogSourceBundle } from "./model.ts";
import { assertCatalogSourceBundle } from "./validation.ts";

export interface CatalogSourcePreparedStatement {
  bind(...values: unknown[]): CatalogSourcePreparedStatement;
}

export interface CatalogSourceDatabase {
  prepare(sql: string): CatalogSourcePreparedStatement;
  batch(statements: CatalogSourcePreparedStatement[]): Promise<unknown[]>;
}

export interface CatalogSourcePublishResult {
  row_counts: {
    sources: number;
    identity_overrides: number;
  };
  statement_count: number;
}

function statement(
  database: CatalogSourceDatabase,
  sql: string,
  ...values: unknown[]
): CatalogSourcePreparedStatement {
  return database.prepare(sql).bind(...values);
}

function ordered<T>(values: T[]): T[] {
  return [...values].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

export async function publishCatalogSourceBundle(
  database: CatalogSourceDatabase,
  value: unknown,
): Promise<CatalogSourcePublishResult> {
  const bundle: CatalogSourceBundle = assertCatalogSourceBundle(value);
  const statements: CatalogSourcePreparedStatement[] = [];
  let overrideCount = 0;

  for (const source of ordered(bundle.sources)) {
    statements.push(statement(
      database,
      `INSERT INTO program_catalog_sources (
         id, school_slug, directory_url, profile_path, catalog_year,
         source_title, adapter, enabled, owner_labels_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         school_slug = excluded.school_slug,
         directory_url = excluded.directory_url,
         profile_path = excluded.profile_path,
         catalog_year = excluded.catalog_year,
         source_title = excluded.source_title,
         adapter = excluded.adapter,
         enabled = excluded.enabled,
         owner_labels_json = excluded.owner_labels_json`,
      source.id,
      source.school_slug,
      source.directory_url,
      source.profile_path,
      source.catalog_year,
      source.source_title,
      source.adapter,
      source.enabled ? 1 : 0,
      JSON.stringify([...source.owner_labels].sort()),
    ));
    statements.push(statement(
      database,
      `DELETE FROM program_catalog_identity_overrides
       WHERE catalog_source_id = ?`,
      source.id,
    ));
    for (const override of ordered(source.identity_overrides)) {
      overrideCount += 1;
      statements.push(statement(
        database,
        `INSERT INTO program_catalog_identity_overrides (
           catalog_source_id, program_slug, type, program_id
         ) VALUES (?, ?, ?, ?)`,
        source.id,
        override.program_slug,
        override.type,
        override.program_id,
      ));
    }
  }

  await database.batch(statements);
  return {
    row_counts: {
      sources: bundle.sources.length,
      identity_overrides: overrideCount,
    },
    statement_count: statements.length,
  };
}
