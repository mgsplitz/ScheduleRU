export function createRequirementImportRepository(env, { now = Date.now } = {}) {
  const { DB: database } = env;

  return {
    findEnabledSource(sourceId) {
      return database.prepare(
        `SELECT id, program_id, school_slug, source_url, source_title, adapter
         FROM program_requirement_import_sources
         WHERE id = ? AND enabled = 1`,
      ).bind(sourceId).first();
    },

    async saveSnapshot(snapshot) {
      const fetchedAt = now();
      const inserted = await database.prepare(
        `INSERT OR IGNORE INTO program_requirement_source_snapshots (
           source_id, program_id, source_url, source_title, content_hash,
           content_text, parsed_json, fetched_at
         ) VALUES (?,?,?,?,?,?,?,?)`,
      ).bind(
        snapshot.source_id,
        snapshot.program_id,
        snapshot.source_url,
        snapshot.source_title,
        snapshot.content_hash,
        snapshot.content_text,
        snapshot.parsed_json,
        fetchedAt,
      ).run();
      await database.prepare(
        `UPDATE program_requirement_import_sources
         SET last_imported_at = ?, last_content_hash = ?, last_error = NULL
         WHERE id = ?`,
      ).bind(fetchedAt, snapshot.content_hash, snapshot.source_id).run();
      return { changed: (inserted.meta?.changes || 0) === 1 };
    },

    async markFailure(sourceId, errorMessage) {
      await database.prepare(
        "UPDATE program_requirement_import_sources SET last_error = ? WHERE id = ?",
      ).bind(errorMessage, sourceId).run();
    },

    async listPendingSources(schoolSlug, batchLimit) {
      const { results } = await database.prepare(
        `SELECT id FROM program_requirement_import_sources
         WHERE school_slug = ?
           AND enabled = 1
           AND last_imported_at IS NULL
           AND last_error IS NULL
         ORDER BY id
         LIMIT ?`,
      ).bind(schoolSlug, batchLimit).all();
      return results || [];
    },
  };
}
