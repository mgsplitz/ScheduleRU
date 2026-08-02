export function createPublicProgramRepository(env) {
  const { DB: database } = env;

  return {
    async listReviewedSchools() {
      const { results } = await database.prepare(
        `SELECT slug, institution_slug, campus_slug, name, short_name,
                catalog_year, configuration_json, source_url, source_title
         FROM school_profiles
         WHERE review_status = 'reviewed'
         ORDER BY sort_order, name`,
      ).all();
      return results || [];
    },

    async listReviewedPrograms({ school, type }) {
      let where = ` WHERE type NOT IN ('shared_requirement_set', 'core_curriculum')
                    AND review_status = 'reviewed'`;
      const binds = [];
      if (school) {
        where += " AND school_slug = ?";
        binds.push(school);
      }
      if (type) {
        where += " AND type = ?";
        binds.push(type);
      }
      const { results } = await database
        .prepare(`SELECT * FROM programs${where} ORDER BY name`)
        .bind(...binds)
        .all();
      return results || [];
    },

    async listReviewedCoreCurricula(school) {
      let where = `WHERE link.review_status = 'reviewed'
                     AND curriculum.review_status = 'reviewed'
                     AND curriculum.type = 'core_curriculum'`;
      const binds = [];
      if (school) {
        where += " AND link.school_slug = ?";
        binds.push(school);
      }
      const { results } = await database.prepare(
        `SELECT curriculum.*, link.school_slug AS attached_school_slug,
                link.module_type, link.source_url AS attachment_source_url
         FROM school_curriculum_modules link
         INNER JOIN programs curriculum ON curriculum.id = link.curriculum_program_id
         ${where}
         ORDER BY link.sort_order, curriculum.name`,
      ).bind(...binds).all();
      return results || [];
    },

    findReviewedProgram(programId) {
      return database.prepare(
        `SELECT * FROM programs
         WHERE id = ?
           AND review_status = 'reviewed'`,
      ).bind(programId).first();
    },

    async listReviewedProgramEvidenceFlags(programIds) {
      const { results } = await database.prepare(
        `SELECT id, requirement_evidence_required, review_status
         FROM programs
         WHERE id IN (${programIds.map(() => "?").join(",")})
           AND review_status = 'reviewed'`,
      ).bind(...programIds).all();
      return results || [];
    },

    async getDoubleCountData(programIds) {
      if (!programIds.length) {
        return { rules: [], exceptions: [] };
      }
      const placeholders = programIds.map(() => "?").join(",");
      const [{ results: rules }, { results: exceptions }] = await Promise.all([
        database.prepare(
          `SELECT * FROM double_count_rules
           WHERE program_a IN (${placeholders})
             AND program_b IN (${placeholders})`,
        ).bind(...programIds, ...programIds).all(),
        database.prepare(
          `SELECT * FROM double_count_exceptions
           WHERE review_status = 'reviewed'
             AND program_a IN (${placeholders})
             AND program_b IN (${placeholders})`,
        ).bind(...programIds, ...programIds).all(),
      ]);
      return { rules: rules || [], exceptions: exceptions || [] };
    },

    async listDoubleCountPolicies(school) {
      const where = school ? " WHERE school_slug = ?" : "";
      const statement = database.prepare(`SELECT * FROM double_count_policies${where}`);
      const { results } = school
        ? await statement.bind(school).all()
        : await statement.all();
      return results || [];
    },

    async listReviewedProgramsByIds(programIds) {
      if (!programIds.length) return [];
      const { results } = await database.prepare(
        `SELECT id, name, school_slug, program_slug, type, degree_type,
                program_family_id, requirement_evidence_required, review_status,
                catalog_active
         FROM programs
         WHERE type NOT IN ('shared_requirement_set', 'core_curriculum')
           AND review_status = 'reviewed'
           AND id IN (${programIds.map(() => "?").join(",")})`,
      ).bind(...programIds).all();
      return results || [];
    },
  };
}
