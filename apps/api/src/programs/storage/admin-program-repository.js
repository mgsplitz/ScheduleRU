export function createAdminProgramRepository(env) {
  const { DB: database } = env;

  return {
    async listRequirementSources(school) {
      const { results } = await database.prepare(
        `SELECT source.id, source.program_id, source.source_url, source.source_title,
                source.adapter, source.source_kind, source.enabled, source.last_imported_at,
                source.last_content_hash, source.last_error,
                (SELECT COUNT(*) FROM program_requirement_source_snapshots snapshot
                 WHERE snapshot.source_id = source.id) AS snapshot_count
         FROM program_requirement_import_sources source
         WHERE source.school_slug = ?
         ORDER BY source.program_id`,
      ).bind(school).all();
      return results || [];
    },

    async listRequirementCandidates(school) {
      const { results } = await database.prepare(
        `SELECT candidate.id, candidate.source_id, candidate.program_id, candidate.source_url,
                candidate.content_hash, candidate.extractor_version, candidate.candidate_json,
                candidate.created_at
         FROM program_requirement_draft_candidates candidate
         INNER JOIN program_requirement_import_sources source ON source.id = candidate.source_id
         WHERE source.school_slug = ?
         ORDER BY candidate.program_id, candidate.created_at DESC`,
      ).bind(school).all();
      return results || [];
    },

    async seedPrograms(programs) {
      const statements = programs.map((program) => database.prepare(
        `INSERT INTO programs (
           id, name, school_slug, program_slug, type, catalog_year,
           academic_program_code, degree_type, program_family_id, source_url
         ) VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, school_slug=excluded.school_slug,
           program_slug=excluded.program_slug, type=excluded.type, catalog_year=excluded.catalog_year,
           academic_program_code=excluded.academic_program_code, degree_type=excluded.degree_type,
           program_family_id=excluded.program_family_id, source_url=excluded.source_url`,
      ).bind(
        program.id,
        program.name,
        program.school_slug,
        program.program_slug,
        program.type,
        program.catalog_year || null,
        program.academic_program_code || null,
        program.degree_type || null,
        program.program_family_id || null,
        program.source_url || null,
      ));
      if (statements.length) await database.batch(statements);
    },

    findProgram(programId) {
      return database.prepare("SELECT * FROM programs WHERE id = ?")
        .bind(programId)
        .first();
    },

    findCoreCurriculum(programId) {
      return database.prepare(
        "SELECT * FROM programs WHERE id = ? AND type = 'core_curriculum'",
      ).bind(programId).first();
    },

    async listPrograms() {
      const { results } = await database.prepare("SELECT * FROM programs").all();
      return results || [];
    },

    async listScrapeLog(limit) {
      const { results } = await database.prepare(
        "SELECT * FROM scrape_log ORDER BY id DESC LIMIT ?",
      ).bind(limit).all();
      return results || [];
    },

    async listProgramsNeedingReview() {
      const { results } = await database.prepare(
        "SELECT * FROM programs WHERE review_status != 'reviewed' OR id IN (SELECT DISTINCT program_id FROM requirement_raw_notes WHERE resolved = 0) ORDER BY name",
      ).all();
      return results || [];
    },

    async listUnresolvedRequirementNotes(programId) {
      const { results } = await database.prepare(
        "SELECT * FROM requirement_raw_notes WHERE program_id = ? AND resolved = 0",
      ).bind(programId).all();
      return results || [];
    },

    async updateProgramReviewStatus(programId, status) {
      await database.prepare("UPDATE programs SET review_status = ? WHERE id = ?")
        .bind(status, programId)
        .run();
    },

    async saveRequirementGroup(group, id) {
      await database.prepare(
        `INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
         VALUES (?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, rule=excluded.rule,
           count=excluded.count, parent_group_id=excluded.parent_group_id`,
      ).bind(
        id,
        group.program_id,
        group.parent_group_id || null,
        group.name,
        group.rule,
        group.count ?? null,
        group.sort_order ?? 0,
      ).run();
      if (Array.isArray(group.courses) && group.courses.length) {
        await database.batch(group.courses.map((code) => database.prepare(
          "INSERT OR REPLACE INTO requirement_courses (group_id, course_code, note) VALUES (?,?,?)",
        ).bind(id, code, "")));
      }
    },

    async resolveRequirementNote(noteId) {
      await database.prepare(
        "UPDATE requirement_raw_notes SET resolved = 1 WHERE id = ?",
      ).bind(noteId).run();
    },

    findRequirementGroup(groupId) {
      return database.prepare("SELECT * FROM requirement_groups WHERE id = ?")
        .bind(groupId)
        .first();
    },

    async listChildRequirementGroupIds(groupId) {
      const { results } = await database.prepare(
        "SELECT id FROM requirement_groups WHERE parent_group_id = ?",
      ).bind(groupId).all();
      return (results || []).map((child) => child.id);
    },

    async deleteRequirementGroups(groupIds) {
      const statements = groupIds.flatMap((id) => [
        database.prepare("DELETE FROM requirement_courses WHERE group_id = ?").bind(id),
        database.prepare("DELETE FROM requirement_groups WHERE id = ?").bind(id),
      ]);
      if (statements.length) await database.batch(statements);
    },
  };
}
