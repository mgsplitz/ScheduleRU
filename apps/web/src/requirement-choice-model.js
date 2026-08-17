/* Pure state transitions for resolving a planner requirement from the catalog. */
(function exposeRequirementChoiceModel(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function copy(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value ?? fallback));
    } catch (_error) {
      return fallback;
    }
  }

  function createIntent({ placeholder = {}, group = {}, returnPage = "nav" } = {}) {
    const context = placeholder.candidateSelectionContext || {};
    const memberCourseCodes = [...new Set([
      ...(Array.isArray(context.memberCourseCodes) ? context.memberCourseCodes : []),
    ].map(text).filter((code) => COURSE_CODE.test(code)))];
    const selectors = copy(
      Array.isArray(context.courseSelectors) ? context.courseSelectors : [],
      [],
    );
    const year = Number(placeholder.year);
    const sem = placeholder.sem === "spring" ? "spring" : "fall";
    return {
      version: 1,
      placeholderId: text(placeholder.id),
      requirementGroupId: text(placeholder.requirementGroupId) || text(group.id),
      sourceType: text(placeholder.sourceType) || text(context.sourceType),
      sourceProgram: text(placeholder.sourceProgram) || text(context.sourceProgram),
      label: text(placeholder.label) || text(group.name) || "Requirement choice",
      memberCourseCodes,
      selectors,
      returnPage: returnPage === "courses" ? "courses" : "nav",
      returnPlacement: Number.isInteger(year) && year >= 1
        ? { year, sem }
        : null,
    };
  }

  function courseMatchesIntent(course, intent, selectorLogic) {
    const code = text(course?.code);
    if (!COURSE_CODE.test(code) || !intent) return false;
    if ((intent.memberCourseCodes || []).includes(code)) return true;
    if (!(intent.selectors || []).length) return false;
    return selectorLogic?.matchesAnySelector?.(course, intent.selectors) === true;
  }

  function commitChoice({ intent, courseId, groupSelections = {} } = {}) {
    const groupId = text(intent?.requirementGroupId);
    const selectedId = text(courseId);
    if (!groupId || !selectedId) return null;
    const next = Object.fromEntries(Object.entries(groupSelections || {}).map(([id, values]) => [
      id,
      Array.isArray(values) ? [...values] : [],
    ]));
    next[groupId] = [...new Set([...(next[groupId] || []), selectedId])];
    return {
      groupSelections: next,
      resolvedPlaceholderId: text(intent.placeholderId),
      returnPage: intent.returnPage === "courses" ? "courses" : "nav",
      returnPlacement: intent.returnPlacement ? copy(intent.returnPlacement, null) : null,
    };
  }

  root.ScheduleRURequirementChoiceModel = {
    createIntent,
    courseMatchesIntent,
    commitChoice,
  };
})(globalThis);
