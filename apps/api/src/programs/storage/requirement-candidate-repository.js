export function createRequirementCandidateRepository(env, { now = Date.now } = {}) {
  const { DB: database } = env;

  return {
    async listPendingSnapshots(schoolSlug, batchLimit) {
      const { results } = await database.prepare(
        `SELECT snapshot.source_id, snapshot.program_id, snapshot.source_url,
                snapshot.content_hash, snapshot.content_text, snapshot.parsed_json
         FROM program_requirement_source_snapshots snapshot
         INNER JOIN program_requirement_import_sources source ON source.id = snapshot.source_id
         INNER JOIN programs program ON program.id = snapshot.program_id
         WHERE source.school_slug = ?
           AND source.source_kind = 'requirements_page'
           AND source.enabled = 1
           AND program.type = 'major'
           AND program.review_status = 'catalog_listed'
           AND NOT EXISTS (
             SELECT 1 FROM program_requirement_draft_candidates candidate
             WHERE candidate.source_id = snapshot.source_id
               AND candidate.content_hash = snapshot.content_hash
               AND candidate.extractor_version = 1
           )
         ORDER BY snapshot.fetched_at, snapshot.id
         LIMIT ?`,
      ).bind(schoolSlug, batchLimit).all();
      return results || [];
    },

    async saveCandidate(candidate) {
      const inserted = await database.prepare(
        `INSERT OR IGNORE INTO program_requirement_draft_candidates (
           source_id, program_id, source_url, content_hash, extractor_version,
           candidate_json, created_at
         ) VALUES (?,?,?,?,?,?,?)`,
      ).bind(
        candidate.source_id,
        candidate.program_id,
        candidate.source_url,
        candidate.content_hash,
        candidate.extractor_version,
        JSON.stringify(candidate),
        now(),
      ).run();
      return { changed: (inserted.meta?.changes || 0) === 1 };
    },
  };
}
