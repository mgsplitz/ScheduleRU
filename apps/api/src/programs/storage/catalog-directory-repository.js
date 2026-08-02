export function createCatalogDirectoryRepository(env, { now = Date.now } = {}) {
  const { DB: database } = env;

  async function runBatches(statements, chunkSize = 100) {
    for (let index = 0; index < statements.length; index += chunkSize) {
      await database.batch(statements.slice(index, index + chunkSize));
    }
  }

  return {
    findEnabledSource(sourceId) {
      return database.prepare(
        `SELECT id, school_slug, directory_url, profile_path, catalog_year,
                source_title, adapter, owner_labels_json
         FROM program_catalog_sources
         WHERE id = ? AND enabled = 1`,
      ).bind(sourceId).first();
    },

    async listIdentityOverrides(sourceId) {
      const { results } = await database.prepare(
        `SELECT program_slug, type, program_id
         FROM program_catalog_identity_overrides
         WHERE catalog_source_id = ?`,
      ).bind(sourceId).all();
      return results || [];
    },

    async acquireImportLease(sourceId, importToken, startedAt) {
      const lease = await database.prepare(
        `UPDATE program_catalog_sources
         SET import_token = ?, import_started_at = ?
         WHERE id = ?
           AND (import_token IS NULL OR import_started_at < ?)`,
      ).bind(importToken, startedAt, sourceId, startedAt - (10 * 60 * 1000)).run();
      return (lease.meta?.changes || 0) === 1;
    },

    async replaceEntries(source, entries, importToken) {
      const importedAt = now();
      const statements = entries.map((entry) => database.prepare(
        `INSERT INTO programs (
           id, name, school_slug, program_slug, type, catalog_year, degree_type,
           program_family_id, source_url, review_status, last_scraped_at,
           catalog_source_id, catalog_listed_at, catalog_active
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           school_slug = excluded.school_slug,
           program_slug = excluded.program_slug,
           type = excluded.type,
           catalog_year = excluded.catalog_year,
           degree_type = excluded.degree_type,
           program_family_id = excluded.program_family_id,
           source_url = excluded.source_url,
           review_status = excluded.review_status,
           last_scraped_at = excluded.last_scraped_at,
           catalog_source_id = excluded.catalog_source_id,
           catalog_listed_at = excluded.catalog_listed_at,
           catalog_active = 1
         WHERE programs.review_status = 'catalog_listed'`,
      ).bind(
        entry.id,
        entry.name,
        entry.school_slug,
        entry.program_slug,
        entry.type,
        entry.catalog_year,
        entry.degree_type,
        entry.program_family_id,
        entry.source_url,
        entry.review_status,
        importedAt,
        source.id,
        importedAt,
      ));
      await runBatches(statements);

      await database.prepare(
        `UPDATE programs
         SET catalog_active = 0
         WHERE catalog_source_id = ?
           AND review_status = 'catalog_listed'
           AND catalog_listed_at < ?`,
      ).bind(source.id, importedAt).run();
      await database.prepare(
        `UPDATE program_catalog_sources
         SET last_imported_at = ?, last_error = NULL,
             import_token = NULL, import_started_at = NULL
         WHERE id = ? AND import_token = ?`,
      ).bind(importedAt, source.id, importToken).run();
    },

    async failImport(sourceId, importToken, errorMessage) {
      await database.prepare(
        `UPDATE program_catalog_sources
         SET last_error = ?, import_token = NULL, import_started_at = NULL
         WHERE id = ? AND import_token = ?`,
      ).bind(errorMessage, sourceId, importToken).run();
    },
  };
}
