function isProgramAdminPath(path) {
  return path.startsWith("/api/admin/programs")
    || path.startsWith("/api/admin/program-catalog")
    || path.startsWith("/api/admin/scrape")
    || path.startsWith("/api/admin/review")
    || path.startsWith("/api/admin/requirement");
}

export async function handleProgramAdminRoute({
  request,
  env,
  ctx,
  path,
  url,
  json,
  checkAdmin,
  services,
}) {
  if (!path.startsWith("/api/admin/") || !isProgramAdminPath(path)) return null;
  if (!checkAdmin(url)) return json({ error: "bad secret" }, 403);

  const {
    RUTGERS_NB_CORE_PROGRAM_ID,
    discoverMajorRequirementSources,
    discoverNestedRequirementDetailSources,
    discoverPrograms,
    extractRequirementCandidateBatch,
    getRequirementTree,
    importCatalogDirectorySource,
    importRequirementSource,
    importRequirementSourceBatch,
    isSafeHomeSchoolSlug,
    pendingMajorProfileSources,
    pendingNestedRequirementDetailSources,
    pendingRequirementCandidateSnapshots,
    pendingRequirementSourceIds,
    registerRequirementSourcesForSchool,
    requirementSourceImportBatchLimit,
    repository,
    scrapeCoreCurriculum,
    scrapeProgram,
    scrapeProgramFromBizSite,
  } = services;

  if (path === "/api/admin/program-catalog/import" && request.method === "POST") {
    const sourceId = url.searchParams.get("source") || "";
    if (!sourceId) return json({ error: "pass ?source=the-catalog-source-id" }, 400);
    const result = await importCatalogDirectorySource(sourceId);
    return json(result, result.ok ? 200 : (result.status || 502));
  }

  if (path === "/api/admin/requirement-sources/register" && request.method === "POST") {
    const school = url.searchParams.get("school") || "";
    try {
      return json({
        ok: true,
        school,
        ...(await registerRequirementSourcesForSchool(env, school)),
      });
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (path === "/api/admin/requirement-sources/discover" && request.method === "POST") {
    const school = url.searchParams.get("school") || "";
    try {
      const registration = await registerRequirementSourcesForSchool(env, school);
      if (!registration.registered) {
        return json({ error: "no active SAS major profiles found for this school" }, 404);
      }
      const batchLimit = requirementSourceImportBatchLimit(url.searchParams.get("limit"));
      const profileSources = await pendingMajorProfileSources(env, school, batchLimit);
      if (!profileSources.length) {
        return json({
          ok: true,
          mode: "complete",
          school,
          queued: 0,
          note: "Every eligible SAS major profile has a discovered requirements source or a recorded discovery error.",
        });
      }
      ctx.waitUntil(discoverMajorRequirementSources(env, profileSources));
      return json({
        ok: true,
        mode: "background",
        school,
        queued: profileSources.length,
        note: "Discovering official major requirement sources only; no program was automatically marked reviewed.",
      });
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (path === "/api/admin/requirement-sources/discover-details" && request.method === "POST") {
    const school = url.searchParams.get("school") || "";
    try {
      const batchLimit = requirementSourceImportBatchLimit(url.searchParams.get("limit"));
      const parentSources = await pendingNestedRequirementDetailSources(env, school, batchLimit);
      if (!parentSources.length) {
        return json({
          ok: true,
          mode: "complete",
          school,
          queued: 0,
          note: "Every eligible SAS major overview source has a recorded nested-link result; no program was automatically marked reviewed.",
        });
      }
      ctx.waitUntil(discoverNestedRequirementDetailSources(env, parentSources));
      return json({
        ok: true,
        mode: "background",
        school,
        queued: parentSources.length,
        note: "Discovering explicitly labelled official major-requirements links only; no audit or review status changes.",
      });
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (path === "/api/admin/requirement-sources" && request.method === "GET") {
    const school = url.searchParams.get("school") || "";
    if (!isSafeHomeSchoolSlug(school)) return json({ error: "pass a valid ?school=..." }, 400);
    return json({ school, sources: await repository.listRequirementSources(school) });
  }

  if (path === "/api/admin/requirement-sources/import" && request.method === "POST") {
    const sourceId = url.searchParams.get("source") || "";
    const school = url.searchParams.get("school") || "";
    if (sourceId) {
      const result = await importRequirementSource(sourceId);
      return json(result, result.ok ? 200 : 502);
    }
    try {
      const registration = await registerRequirementSourcesForSchool(env, school);
      if (!registration.registered) {
        return json({ error: "no active catalog sources found for this school" }, 404);
      }
      const batchLimit = requirementSourceImportBatchLimit(url.searchParams.get("limit"));
      const sources = await pendingRequirementSourceIds(school, batchLimit);
      if (!sources.length) {
        return json({
          ok: true,
          mode: "complete",
          school,
          sources: registration.registered,
          queued: 0,
          note: "All eligible sources have draft snapshots; no program was automatically marked reviewed.",
        });
      }
      ctx.waitUntil(importRequirementSourceBatch(sources));
      return json({
        ok: true,
        mode: "background",
        school,
        sources: registration.registered,
        queued: sources.length,
        note: "Draft source snapshots only; no program was automatically marked reviewed.",
      });
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (path === "/api/admin/requirement-candidates/extract" && request.method === "POST") {
    const school = url.searchParams.get("school") || "";
    try {
      const batchLimit = requirementSourceImportBatchLimit(url.searchParams.get("limit"));
      const snapshots = await pendingRequirementCandidateSnapshots(env, school, batchLimit);
      if (!snapshots.length) {
        return json({
          ok: true,
          mode: "complete",
          school,
          queued: 0,
          note: "Every snapshotted SAS major source has a generic draft candidate; no program was automatically marked reviewed.",
        });
      }
      ctx.waitUntil(extractRequirementCandidateBatch(env, snapshots));
      return json({
        ok: true,
        mode: "background",
        school,
        queued: snapshots.length,
        note: "Extracting draft source sections only; no degree audit or review status changes.",
      });
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (path === "/api/admin/requirement-candidates" && request.method === "GET") {
    const school = url.searchParams.get("school") || "";
    if (school !== "sasnb") {
      return json({
        error: "draft candidate extraction currently supports ?school=sasnb majors only",
      }, 400);
    }
    return json({ school, candidates: await repository.listRequirementCandidates(school) });
  }

  if (path === "/api/admin/programs/seed" && request.method === "POST") {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    await repository.seedPrograms(items);
    return json({ ok: true, seeded: items.length });
  }

  if (path === "/api/admin/programs/discover" && request.method === "POST") {
    const schoolSlug = url.searchParams.get("school");
    const indexPath = url.searchParams.get("index_path");
    if (!schoolSlug || !indexPath) {
      return json({ error: "pass ?school=...&index_path=..." }, 400);
    }
    return json(await discoverPrograms(env, schoolSlug, indexPath));
  }

  if (path === "/api/admin/scrape-programs" && request.method === "POST") {
    const singleId = url.searchParams.get("program");
    let targets;
    if (singleId) {
      const program = await repository.findProgram(singleId);
      if (!program) return json({ error: "unknown program id" }, 404);
      if (program.school_slug === "rbsnb") {
        return json({
          error: "Coursedog is not an approved RBS requirements source; use /api/admin/scrape-programs-biz for a supported RBS major.",
        }, 400);
      }
      targets = [program];
    } else {
      targets = (await repository.listPrograms())
        .filter((program) => program.school_slug !== "rbsnb");
    }
    const run = async () => {
      const results = [];
      for (const program of targets) {
        results.push({ id: program.id, ...(await scrapeProgram(env, program)) });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return results;
    };
    if (targets.length > 1) {
      ctx.waitUntil(run());
      return json({
        ok: true,
        mode: "background",
        programs: targets.length,
        note: "poll GET /api/admin/scrape-log",
      });
    }
    return json({ ok: true, mode: "sync", results: await run() });
  }

  if (path === "/api/admin/scrape-log" && request.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
    return json({ log: await repository.listScrapeLog(limit) });
  }

  if (path === "/api/admin/scrape-programs-biz" && request.method === "POST") {
    const programId = url.searchParams.get("program");
    if (!programId) {
      return json({
        error: "pass ?program=id — this endpoint is single-program-only until you've checked its output once",
      }, 400);
    }
    const program = await repository.findProgram(programId);
    if (!program) return json({ error: "unknown program id" }, 404);
    const result = await scrapeProgramFromBizSite(env, program);
    return json({ ok: result.ok, program: programId, ...result });
  }

  if (path === "/api/admin/scrape-core-curriculum" && request.method === "POST") {
    const programId = url.searchParams.get("program") || RUTGERS_NB_CORE_PROGRAM_ID;
    const program = await repository.findCoreCurriculum(programId);
    if (!program) return json({ error: "unknown Core Curriculum id" }, 404);
    const result = await scrapeCoreCurriculum(env, program);
    return json({ ok: result.ok, program: programId, ...result });
  }

  if (path === "/api/admin/review" && request.method === "GET") {
    const programs = await repository.listProgramsNeedingReview();
    const reviewQueue = [];
    for (const program of programs) {
      const requirements = await getRequirementTree(env, program.id);
      const notes = await repository.listUnresolvedRequirementNotes(program.id);
      reviewQueue.push({ program, requirements, unresolved_notes: notes });
    }
    return json({ review_queue: reviewQueue });
  }

  if (path === "/api/admin/programs/review-status" && request.method === "POST") {
    const { program_id: programId, status } = await request.json();
    await repository.updateProgramReviewStatus(programId, status);
    return json({ ok: true });
  }

  if (path === "/api/admin/requirement-groups" && request.method === "POST") {
    const group = await request.json();
    const id = group.id || `${group.program_id}-manual-${Date.now()}`;
    await repository.saveRequirementGroup(group, id);
    return json({ ok: true, id });
  }

  if (path.match(/^\/api\/admin\/requirement-notes\/\d+\/resolve$/) && request.method === "POST") {
    const noteId = Number(path.split("/")[4]);
    await repository.resolveRequirementNote(noteId);
    return json({ ok: true });
  }

  if (path.match(/^\/api\/admin\/requirement-groups\/[^/]+$/) && request.method === "DELETE") {
    const groupId = decodeURIComponent(path.split("/")[4]);
    const group = await repository.findRequirementGroup(groupId);
    if (!group) return json({ error: "not found" }, 404);
    if (group.auto_generated) {
      return json({
        error: "refusing to delete an auto_generated group — re-scrape the program instead, or edit it via POST if you really mean to hand-override it",
      }, 400);
    }
    const childIds = await repository.listChildRequirementGroupIds(groupId);
    const allIds = [groupId, ...childIds];
    await repository.deleteRequirementGroups(allIds);
    return json({ ok: true, deleted: allIds });
  }

  return json({ error: "not found under /api/admin" }, 404);
}
