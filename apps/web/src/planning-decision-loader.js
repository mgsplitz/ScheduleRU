/* Loads finite candidates for reviewed selector-backed planning decisions. */
(function exposePlanningDecisionLoader(root) {
  const PAGE_SIZE = 100;
  const copy = (value, fallback = []) => {
    try { return JSON.parse(JSON.stringify(value ?? fallback)); } catch (_error) { return fallback; }
  };

  function normalizedSelectors(rows) {
    return (rows || []).map((row) => {
      const value = row?.selector_json ?? row?.selector ?? row;
      if (typeof value !== "string") return value;
      try { return JSON.parse(value); } catch (_error) { return null; }
    }).filter(Boolean);
  }

  function mergeCandidateRecords(left = {}, right = {}) {
    const merged = { ...left };
    Object.entries(right || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (Array.isArray(value) && !value.length && Array.isArray(merged[key]) && merged[key].length) return;
      merged[key] = value;
    });
    return merged;
  }

  function mergeCandidates(...lists) {
    const byCode = new Map();
    lists.flat().filter((course) => course?.code).forEach((course) => {
      byCode.set(course.code, mergeCandidateRecords(byCode.get(course.code), course));
    });
    return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  }

  async function hydrate({ decisions = [], request, normalizeCandidate = (value) => value } = {}) {
    if (typeof request !== "function") throw new TypeError("request must be a function");
    const cache = new Map();

    async function candidatesFor(courseSelectors) {
      const selectors = normalizedSelectors(courseSelectors);
      if (!selectors.length) return [];
      const key = JSON.stringify(selectors);
      if (!cache.has(key)) cache.set(key, (async () => {
        const courses = [];
        let offset = 0;
        let total = Infinity;
        while (offset < total) {
          const params = new URLSearchParams({
            selector: JSON.stringify(selectors),
            limit: String(PAGE_SIZE),
            offset: String(offset),
          });
          const page = await request(`/api/courses?${params.toString()}`);
          const rows = Array.isArray(page?.courses) ? page.courses : [];
          courses.push(...rows);
          total = Number.isFinite(Number(page?.total)) ? Number(page.total) : courses.length;
          if (!rows.length || rows.length < PAGE_SIZE) break;
          offset += rows.length;
        }
        const normalized = await Promise.all(courses.map((course) => normalizeCandidate(course)));
        return [...new Map(normalized.filter((course) => course?.code).map((course) => [course.code, course])).values()]
          .sort((left, right) => left.code.localeCompare(right.code));
      })());
      return copy(await cache.get(key));
    }

    return Promise.all((decisions || []).map(async (decision) => {
      if (!(decision.courseSelectors || []).length) return copy(decision, {});
      const explicit = decision.candidates || [];
      const selected = await candidatesFor(decision.courseSelectors);
      const selectedCodes = new Set(selected.map((candidate) => candidate.code));
      const supplemental = explicit.filter((candidate) => !selectedCodes.has(candidate.code));
      const optionFamily = supplemental.length > 1
        ? `${decision.decisionId || decision.requirementGroupId}:explicit-alternatives`
        : null;
      return {
        ...copy(decision, {}),
        candidates: mergeCandidates(explicit, selected).map((candidate) =>
          optionFamily && supplemental.some((record) => record.code === candidate.code)
            ? { ...candidate, optionFamily }
            : candidate),
      };
    }));
  }

  function normalizedMetadataCourse(record = {}) {
    const rules = record.compiled_rules || record.compiledRules || {};
    return {
      code: record.course_code || record.code,
      title: record.title,
      credits: Number(record.credits) > 0 ? Number(record.credits) : 3,
      creditsEstimated: !(Number(record.credits) > 0),
      prerequisitePaths: copy(rules.prerequisitePaths || record.prerequisitePaths),
      enforceablePrerequisitePaths: copy(rules.enforceablePrerequisitePaths || record.enforceablePrerequisitePaths),
      corequisitePaths: copy(rules.corequisitePaths || record.corequisitePaths),
      minimumPlanYear: Number(rules.minimumPlanYear || record.minimumPlanYear) || null,
      minimumPriorCredits: Number(rules.minimumPriorCredits || record.minimumPriorCredits) || null,
      creditExclusionFamilies: copy(rules.creditExclusionFamilies || record.creditExclusionFamilies),
      ruleCoverage: rules.ruleCoverage || record.ruleCoverage || "unresolved",
    };
  }

  function prerequisiteCodes(courses = []) {
    return [...new Set((courses || []).flatMap((course) =>
      [...(course.prerequisitePaths || []), ...(course.enforceablePrerequisitePaths || [])].flat()
    ).filter(Boolean))].sort();
  }

  async function hydratePrerequisiteMetadata({ decisions = [], seedCourses = [], request } = {}) {
    if (typeof request !== "function") throw new TypeError("request must be a function");
    const metadata = new Map((seedCourses || []).map(normalizedMetadataCourse)
      .filter((course) => course.code).map((course) => [course.code, course]));
    const candidateCourses = (decisions || []).flatMap((decision) => decision.candidates || []);
    let pending = prerequisiteCodes([...candidateCourses, ...seedCourses])
      .filter((code) => !metadata.has(code));
    const requested = new Set();
    while (pending.length) {
      const batch = pending.slice(0, 100);
      pending = pending.slice(100);
      batch.forEach((code) => requested.add(code));
      const params = new URLSearchParams({ codes: batch.join(",") });
      const response = await request(`/api/course-metadata?${params.toString()}`);
      const courses = (Array.isArray(response?.courses) ? response.courses : [])
        .map(normalizedMetadataCourse).filter((course) => course.code);
      courses.forEach((course) => metadata.set(course.code, course));
      prerequisiteCodes(courses).forEach((code) => {
        if (!metadata.has(code) && !requested.has(code) && !pending.includes(code)) pending.push(code);
      });
      pending.sort();
    }
    const prerequisiteCourses = [...metadata.values()].filter((record) => record.code && record.title)
      .sort((left, right) => left.code.localeCompare(right.code));
    return (decisions || []).map((decision) => ({ ...copy(decision, {}), prerequisiteCourses: copy(prerequisiteCourses) }));
  }

  root.ScheduleRUPlanningDecisionLoader = { hydrate, hydratePrerequisiteMetadata, normalizedSelectors, mergeCandidates };
})(globalThis);
