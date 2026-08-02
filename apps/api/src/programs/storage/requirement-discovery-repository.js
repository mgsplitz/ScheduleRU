function requirementSourceIdForProgram(programId) {
  return `requirements-${programId}`;
}

function requirementDetailSourceIdForProgram(programId) {
  return `detail-${programId}`;
}

function nestedRequirementDetailSourceIdForProgram(programId) {
  return `nested-${programId}`;
}

function validProgramId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

async function runBatches(database, statements, chunkSize = 100) {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await database.batch(statements.slice(index, index + chunkSize));
  }
}

export function createRequirementDiscoveryRepository(env, { now = Date.now } = {}) {
  const { DB: database } = env;

  return {
    async registerProfileSources(schoolSlug) {
      const { results } = await database.prepare(
        `SELECT id, name, school_slug, source_url
         FROM programs
         WHERE school_slug = ?
           AND type = 'major'
           AND review_status = 'catalog_listed'
           AND catalog_active = 1
           AND source_url LIKE 'https://%'
         ORDER BY id`,
      ).bind(schoolSlug).all();
      const programs = (results || []).filter((program) => validProgramId(program.id));
      await runBatches(database, programs.map((program) => database.prepare(
        `INSERT INTO program_requirement_import_sources (
           id, program_id, school_slug, source_url, source_title, adapter, source_kind, enabled
         ) VALUES (?,?,?,?,?,'html_requirement_source_v1','profile',1)
         ON CONFLICT(program_id, source_url) DO UPDATE SET
           school_slug = excluded.school_slug,
           source_title = excluded.source_title,
           source_kind = excluded.source_kind,
           enabled = 1`,
      ).bind(
        requirementSourceIdForProgram(program.id),
        program.id,
        program.school_slug,
        program.source_url,
        `${program.name} official program profile`,
      )));
      return programs.length;
    },

    async listPendingProfiles(schoolSlug, batchLimit) {
      const { results } = await database.prepare(
        `SELECT source.id, source.program_id, source.school_slug, source.source_url,
                source.source_title, source.adapter
         FROM program_requirement_import_sources source
         INNER JOIN programs program ON program.id = source.program_id
         WHERE source.school_slug = ?
           AND source.source_kind = 'profile'
           AND source.enabled = 1
           AND source.last_error IS NULL
           AND program.type = 'major'
           AND program.review_status = 'catalog_listed'
           AND program.catalog_active = 1
           AND NOT EXISTS (
             SELECT 1 FROM program_requirement_import_sources detail
             WHERE detail.program_id = source.program_id
               AND detail.source_kind = 'requirements_page'
           )
         ORDER BY source.id
         LIMIT ?`,
      ).bind(schoolSlug, batchLimit).all();
      return results || [];
    },

    async saveProfileDetail(profileSource, detailSource) {
      await database.prepare(
        `INSERT INTO program_requirement_import_sources (
           id, program_id, school_slug, source_url, source_title, adapter, source_kind, enabled
         ) VALUES (?,?,?,?,?,'html_requirement_source_v1','requirements_page',1)
         ON CONFLICT(program_id, source_url) DO UPDATE SET
           source_title = excluded.source_title,
           source_kind = excluded.source_kind,
           enabled = 1,
           last_error = NULL`,
      ).bind(
        requirementDetailSourceIdForProgram(profileSource.program_id),
        profileSource.program_id,
        profileSource.school_slug,
        detailSource.source_url,
        detailSource.source_title,
      ).run();
    },

    async markSourceError(sourceId, message) {
      await database.prepare(
        "UPDATE program_requirement_import_sources SET last_error = ? WHERE id = ?",
      ).bind(message, sourceId).run();
    },

    async listPendingNestedDetails(schoolSlug, batchLimit) {
      const { results } = await database.prepare(
        `SELECT source.id, source.program_id, source.school_slug, source.source_url,
                source.source_title, source.adapter
         FROM program_requirement_import_sources source
         INNER JOIN program_requirement_draft_candidates candidate
           ON candidate.source_id = source.id
         INNER JOIN programs program ON program.id = source.program_id
         WHERE source.school_slug = ?
           AND source.id LIKE 'detail-%'
           AND source.source_kind = 'requirements_page'
           AND source.enabled = 1
           AND program.type = 'major'
           AND program.review_status = 'catalog_listed'
           AND candidate.extractor_version = 1
           AND json_array_length(candidate.candidate_json, '$.sections') = 0
           AND NOT EXISTS (
             SELECT 1 FROM program_requirement_source_discovery_attempts attempt
             WHERE attempt.parent_source_id = source.id
               AND attempt.discovery_kind = 'nested_major_requirements'
           )
         ORDER BY source.id
         LIMIT ?`,
      ).bind(schoolSlug, batchLimit).all();
      return results || [];
    },

    async recordNestedAttempt(source, status, discoveredUrl = null, note = null) {
      await database.prepare(
        `INSERT INTO program_requirement_source_discovery_attempts (
           parent_source_id, program_id, discovery_kind, status,
           discovered_source_url, checked_at, note
         ) VALUES (?,?,'nested_major_requirements',?,?,?,?)
         ON CONFLICT(parent_source_id, discovery_kind) DO UPDATE SET
           status = excluded.status,
           discovered_source_url = excluded.discovered_source_url,
           checked_at = excluded.checked_at,
           note = excluded.note`,
      ).bind(source.id, source.program_id, status, discoveredUrl, now(), note).run();
    },

    async saveNestedDetail(parentSource, detailSource) {
      await database.prepare(
        `INSERT INTO program_requirement_import_sources (
           id, program_id, school_slug, source_url, source_title, adapter, source_kind, enabled
         ) VALUES (?,?,?,?,?,'html_requirement_source_v1','requirements_page',1)
         ON CONFLICT(id) DO UPDATE SET
           source_url = excluded.source_url,
           source_title = excluded.source_title,
           source_kind = excluded.source_kind,
           enabled = 1,
           last_error = NULL`,
      ).bind(
        nestedRequirementDetailSourceIdForProgram(parentSource.program_id),
        parentSource.program_id,
        parentSource.school_slug,
        detailSource.source_url,
        detailSource.source_title,
      ).run();
    },
  };
}
