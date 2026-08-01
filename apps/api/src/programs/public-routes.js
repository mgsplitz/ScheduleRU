export async function handlePublicProgramRoute({
  request,
  env,
  path,
  url,
  json,
  services,
}) {
  const {
    evaluateProgramSelection,
    getProgramEligibilityRules,
    getProgramSelectionPolicies,
    getRequirementTree,
    getReviewedCourseEligibility,
    isSafeHomeSchoolSlug,
    isSafeProgramId,
    programHasCompleteRequirementEvidence,
    publicSchoolProfile,
    publishedCatalogPrograms,
    reviewedCourseCodes,
  } = services;

  if (path === "/api/schools" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT slug, institution_slug, campus_slug, name, short_name,
              catalog_year, configuration_json, source_url, source_title
       FROM school_profiles
       WHERE review_status = 'reviewed'
       ORDER BY sort_order, name`,
    ).all();
    return json({
      schools: (results || []).map(publicSchoolProfile).filter((school) => school.slug),
    });
  }

  if (path === "/api/programs" && request.method === "GET") {
    const school = url.searchParams.get("school");
    const type = url.searchParams.get("type");
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
    const { results } = await env.DB
      .prepare(`SELECT * FROM programs${where} ORDER BY name`)
      .bind(...binds)
      .all();
    const reviewedPrograms = [];
    for (const program of results || []) {
      if (await programHasCompleteRequirementEvidence(env, program)) {
        reviewedPrograms.push(program);
      }
    }
    const programs = publishedCatalogPrograms([], reviewedPrograms);
    const eligibilityRules = await getProgramEligibilityRules(
      env,
      reviewedPrograms.map((program) => program.id),
    );
    const rulesByProgram = {};
    for (const rule of eligibilityRules) {
      (rulesByProgram[rule.program_id] ||= []).push(rule);
    }
    return json({
      programs: programs.map((program) => ({
        ...program,
        eligibility_rules: rulesByProgram[program.id] || [],
      })),
    });
  }

  if (path === "/api/core-curricula" && request.method === "GET") {
    const school = url.searchParams.get("school");
    let where = `WHERE link.review_status = 'reviewed'
                   AND curriculum.review_status = 'reviewed'
                   AND curriculum.type = 'core_curriculum'`;
    const binds = [];
    if (school) {
      where += " AND link.school_slug = ?";
      binds.push(school);
    }
    const { results } = await env.DB.prepare(
      `SELECT curriculum.*, link.school_slug AS attached_school_slug,
              link.module_type, link.source_url AS attachment_source_url
       FROM school_curriculum_modules link
       INNER JOIN programs curriculum ON curriculum.id = link.curriculum_program_id
       ${where}
       ORDER BY link.sort_order, curriculum.name`,
    ).bind(...binds).all();
    return json({ curricula: results });
  }

  if (path.match(/^\/api\/programs\/[^/]+\/requirements$/) && request.method === "GET") {
    const programId = decodeURIComponent(path.split("/")[3]);
    const program = await env.DB.prepare(
      `SELECT * FROM programs
       WHERE id = ?
         AND review_status = 'reviewed'`,
    ).bind(programId).first();
    if (!program) return json({ error: "not found" }, 404);
    if (!(await programHasCompleteRequirementEvidence(env, program))) {
      return json({ error: "not found" }, 404);
    }
    const [tree, eligibilityRules] = await Promise.all([
      getRequirementTree(env, programId),
      getProgramEligibilityRules(env, [programId]),
    ]);
    return json({ program, requirements: tree, eligibility_rules: eligibilityRules });
  }

  if (path === "/api/requirements" && request.method === "GET") {
    const ids = (url.searchParams.get("programs") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!ids.length || ids.length > 25) {
      return json({ error: "pass 1-25 valid program ids in ?programs=id1,id2" }, 400);
    }
    const out = {};
    const { results: publicPrograms } = await env.DB.prepare(
      `SELECT id, requirement_evidence_required, review_status
       FROM programs
       WHERE id IN (${ids.map(() => "?").join(",")})
         AND review_status = 'reviewed'`,
    ).bind(...ids).all();
    const visibleProgramIds = new Set();
    for (const program of publicPrograms || []) {
      if (await programHasCompleteRequirementEvidence(env, program)) {
        visibleProgramIds.add(program.id);
      }
    }
    const visibleIds = ids.filter((id) => visibleProgramIds.has(id));
    for (const id of visibleIds) {
      out[id] = await getRequirementTree(env, id, visibleIds);
    }

    let doubleCounts = [];
    let doubleCountExceptions = [];
    if (visibleIds.length) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM double_count_rules
         WHERE program_a IN (${visibleIds.map(() => "?").join(",")})
           AND program_b IN (${visibleIds.map(() => "?").join(",")})`,
      ).bind(...visibleIds, ...visibleIds).all();
      doubleCounts = results;
      const { results: exceptions } = await env.DB.prepare(
        `SELECT * FROM double_count_exceptions
         WHERE review_status = 'reviewed'
           AND program_a IN (${visibleIds.map(() => "?").join(",")})
           AND program_b IN (${visibleIds.map(() => "?").join(",")})`,
      ).bind(...visibleIds, ...visibleIds).all();
      doubleCountExceptions = exceptions || [];
    }
    const eligibilityRules = await getProgramEligibilityRules(env, visibleIds);
    return json({
      requirements: out,
      catalog_listed_program_ids: [],
      double_count_rules: doubleCounts,
      double_count_exceptions: doubleCountExceptions,
      eligibility_rules: eligibilityRules,
    });
  }

  if (path === "/api/course-eligibility" && request.method === "GET") {
    const codes = reviewedCourseCodes((url.searchParams.get("codes") || "").split(","));
    if (!codes.length || codes.length > 25) {
      return json({ error: "pass up to 25 valid course codes in ?codes=" }, 400);
    }
    return json({ eligibility: await getReviewedCourseEligibility(env, codes) });
  }

  if (path === "/api/double-count-policies" && request.method === "GET") {
    const school = url.searchParams.get("school");
    let where = "";
    const binds = [];
    if (school) {
      where = " WHERE school_slug = ?";
      binds.push(school);
    }
    const { results } = await env.DB
      .prepare(`SELECT * FROM double_count_policies${where}`)
      .bind(...binds)
      .all();
    return json({ policies: results });
  }

  if (path === "/api/program-selection-policies" && request.method === "GET") {
    const homeSchoolSlug = url.searchParams.get("home_school") || "";
    if (!isSafeHomeSchoolSlug(homeSchoolSlug)) {
      return json({ error: "pass a valid ?home_school=..." }, 400);
    }
    return json({
      home_school_slug: homeSchoolSlug,
      ...(await getProgramSelectionPolicies(env, homeSchoolSlug)),
    });
  }

  if (path === "/api/program-selection-check" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "body must be JSON" }, 400);
    }
    const homeSchoolSlug = body?.home_school;
    const programIds = Array.isArray(body?.program_ids) ? body.program_ids : null;
    if (!isSafeHomeSchoolSlug(homeSchoolSlug)) {
      return json({ error: "body.home_school must be a valid school slug" }, 400);
    }
    if (!programIds || programIds.length > 20 || programIds.some((id) => !isSafeProgramId(id))) {
      return json({ error: "body.program_ids must contain up to 20 valid program ids" }, 400);
    }
    const ids = [...new Set(programIds)];
    const programs = [];
    if (ids.length) {
      const { results } = await env.DB.prepare(
        `SELECT id, name, school_slug, program_slug, type, degree_type,
                program_family_id, requirement_evidence_required, review_status,
                catalog_active
         FROM programs
         WHERE type NOT IN ('shared_requirement_set', 'core_curriculum')
           AND review_status = 'reviewed'
           AND id IN (${ids.map(() => "?").join(",")})`,
      ).bind(...ids).all();
      for (const program of results || []) {
        if (await programHasCompleteRequirementEvidence(env, program)) {
          programs.push(program);
        }
      }
    }
    const [policyData, eligibilityRules] = await Promise.all([
      getProgramSelectionPolicies(env, homeSchoolSlug),
      getProgramEligibilityRules(
        env,
        programs
          .filter((program) => program.review_status === "reviewed")
          .map((program) => program.id),
      ),
    ]);
    return json(evaluateProgramSelection({
      homeSchoolSlug,
      selectedProgramIds: ids,
      programs,
      limits: policyData.limits,
      combinationPolicies: policyData.combination_policies,
      eligibilityRules,
    }));
  }

  return null;
}
