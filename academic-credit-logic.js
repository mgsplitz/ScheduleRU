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

  root.ScheduleRUAcademicCredit = {
    satisfiedCourseCodes,
    equivalencyEdges,
    normalizeCourseCode,
  };
})(globalThis);
