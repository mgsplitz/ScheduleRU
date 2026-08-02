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
    repository,
  } = services;

  if (path === "/api/schools" && request.method === "GET") {
    return json({
      schools: (await repository.listReviewedSchools())
        .map(publicSchoolProfile)
        .filter((school) => school.slug),
    });
  }

  if (path === "/api/programs" && request.method === "GET") {
    const school = url.searchParams.get("school");
    const type = url.searchParams.get("type");
    const reviewedPrograms = [];
    for (const program of await repository.listReviewedPrograms({ school, type })) {
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
    return json({ curricula: await repository.listReviewedCoreCurricula(school) });
  }

  if (path.match(/^\/api\/programs\/[^/]+\/requirements$/) && request.method === "GET") {
    const programId = decodeURIComponent(path.split("/")[3]);
    const program = await repository.findReviewedProgram(programId);
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
    const publicPrograms = await repository.listReviewedProgramEvidenceFlags(ids);
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

    const doubleCountData = await repository.getDoubleCountData(visibleIds);
    const eligibilityRules = await getProgramEligibilityRules(env, visibleIds);
    return json({
      requirements: out,
      catalog_listed_program_ids: [],
      double_count_rules: doubleCountData.rules,
      double_count_exceptions: doubleCountData.exceptions,
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
    return json({ policies: await repository.listDoubleCountPolicies(school) });
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
    for (const program of await repository.listReviewedProgramsByIds(ids)) {
      if (await programHasCompleteRequirementEvidence(env, program)) {
        programs.push(program);
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
