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
      return {
        ...copy(decision, {}),
        candidates: mergeCandidates(decision.candidates || [], await candidatesFor(decision.courseSelectors)),
      };
    }));
  }

  root.ScheduleRUPlanningDecisionLoader = { hydrate, normalizedSelectors, mergeCandidates };
})(globalThis);
