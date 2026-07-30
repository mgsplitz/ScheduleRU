/*
 * Canonical academic-credit resolution shared by requirements, prerequisite
 * checks, course details, and four-year planning. Course-specific relationships
 * come from reviewed requirement alternatives; this module only closes those
 * generic directed edges.
 */
(function exposeAcademicCreditLogic(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;

  function normalizeCourseCode(value) {
    const normalized = String(value || "").trim();
    if (COURSE_CODE.test(normalized)) return normalized;
    return /^\d{8}$/.test(normalized)
      ? `${normalized.slice(0, 2)}:${normalized.slice(2, 5)}:${normalized.slice(5)}`
      : "";
  }

  function normalizedTrees(values) {
    return (Array.isArray(values) ? values : [])
      .map((value) => value?.tree || value)
      .filter((value) => value && typeof value === "object");
  }

  function equivalencyEdges(requirementTrees) {
    const canonicalByAlternative = new Map();
    for (const tree of normalizedTrees(requirementTrees)) {
      for (const course of Object.values(tree.courses || {})) {
        const canonical = normalizeCourseCode(course?.code);
        if (!canonical) continue;
        for (const alternative of course?.alternatives || []) {
          const equivalent = normalizeCourseCode(
            alternative?.code
            || alternative?.course_code
            || alternative?.equivalent_course_code,
          );
          if (!equivalent || equivalent === canonical) continue;
          const targets = canonicalByAlternative.get(equivalent) || new Set();
          targets.add(canonical);
          canonicalByAlternative.set(equivalent, targets);
        }
      }
    }
    return canonicalByAlternative;
  }

  function satisfiedCourseCodes({ confirmedCourseCodes = [], requirementTrees = [] } = {}) {
    const satisfied = new Set((confirmedCourseCodes || []).map(normalizeCourseCode).filter(Boolean));
    const pending = [...satisfied];
    const edges = equivalencyEdges(requirementTrees);
    for (let index = 0; index < pending.length; index += 1) {
      for (const canonical of edges.get(pending[index]) || []) {
        if (satisfied.has(canonical)) continue;
        satisfied.add(canonical);
        pending.push(canonical);
      }
    }
    return satisfied;
  }

  function expandedPlannedCourseEntries({ entries = [], requirementTrees = [] } = {}) {
    const expanded = [];
    const seen = new Set();
    for (const rawEntry of Array.isArray(entries) ? entries : []) {
      const courseCode = normalizeCourseCode(rawEntry?.course_code);
      if (!courseCode) continue;
      const codes = [...satisfiedCourseCodes({
        confirmedCourseCodes: [courseCode],
        requirementTrees,
      })].sort((left, right) => Number(left !== courseCode) - Number(right !== courseCode)
        || left.localeCompare(right));
      for (const code of codes) {
        const key = `${code}:${Number(rawEntry?.year)}:${String(rawEntry?.sem || "")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        expanded.push({
          ...rawEntry,
          id: code === courseCode ? rawEntry.id : `${rawEntry.id || `scheduled:${courseCode}`}:equivalent:${code}`,
          course_code: code,
          credits: code === courseCode ? Number(rawEntry?.credits) || 0 : 0,
          equivalent_of_course_code: code === courseCode ? undefined : courseCode,
        });
      }
    }
    return expanded;
  }

  function reachableCourseCodes(start, edges) {
    const reachable = new Set();
    const pending = [start];
    for (let index = 0; index < pending.length; index += 1) {
      for (const target of edges.get(pending[index]) || []) {
        if (target === start || reachable.has(target)) continue;
        reachable.add(target);
        pending.push(target);
      }
    }
    return reachable;
  }

  function redundantCanonicalCourseCodes({ courseCodes = [], requirementTrees = [] } = {}) {
    const concrete = new Set((courseCodes || []).map(normalizeCourseCode).filter(Boolean));
    const edges = equivalencyEdges(requirementTrees);
    const reachableByCode = new Map(
      [...concrete].sort().map((code) => [code, reachableCourseCodes(code, edges)]),
    );
    const redundant = new Set();

    for (const alternative of [...concrete].sort()) {
      for (const canonical of [...(reachableByCode.get(alternative) || [])].sort()) {
        if (!concrete.has(canonical)) continue;
        // A reciprocal path represents ambiguous/cyclic source data. Keep both
        // courses instead of silently removing either one.
        const reverseReachable = reachableByCode.get(canonical)
          || reachableCourseCodes(canonical, edges);
        if (!reverseReachable.has(alternative)) redundant.add(canonical);
      }
    }
    return redundant;
  }

  root.ScheduleRUAcademicCredit = {
    satisfiedCourseCodes,
    expandedPlannedCourseEntries,
    redundantCanonicalCourseCodes,
    equivalencyEdges,
    normalizeCourseCode,
  };
})(globalThis);
