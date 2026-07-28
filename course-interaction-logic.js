/*
 * Pure course-interaction decisions shared by requirement, catalog, wishlist,
 * and semester-plan views.
 */
(function exposeCourseInteractionLogic(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:(\d{3})$/;

  function present(value) {
    return value !== undefined && value !== null
      && (typeof value !== "string" || value.trim() !== "");
  }

  function mergeCourseRecords(records = []) {
    return (Array.isArray(records) ? records : []).reduce((merged, record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return merged;
      Object.entries(record).forEach(([key, value]) => {
        if (!present(value)) return;
        const placeholderTitle = (key === "title" || key === "fullTitle")
          && present(merged.code) && merged[key] === merged.code && value !== merged.code;
        if (!present(merged[key]) || placeholderTitle) merged[key] = value;
      });
      return merged;
    }, {});
  }

  function courseNumber(course) {
    const code = typeof course === "object" ? course?.code : course;
    const match = COURSE_CODE.exec(String(code || "").trim());
    return match ? Number(match[1]) : null;
  }

  function selectedCourseCodes(groupSelections = {}, resolveCourse = () => null) {
    const seen = new Set();
    return Object.values(groupSelections || {}).flatMap((ids) => (
      Array.isArray(ids) ? ids : []
    )).map((id) => String(resolveCourse(id)?.code || "").trim())
      .filter((code) => COURSE_CODE.test(code) && !seen.has(code) && seen.add(code));
  }

  function requirementSelectionAction({
    eligible = false,
    selected = false,
    openSlots = 0,
    inWishlist = false,
  } = {}) {
    if (selected) {
      return {
        select: false,
        wishlist: inWishlist,
        removeSelection: true,
        removeWishlist: false,
      };
    }
    return {
      select: eligible && Number(openSlots) > 0,
      wishlist: true,
      removeSelection: false,
      removeWishlist: false,
    };
  }

  function expansionOpen({ stored, defaultOpen = false } = {}) {
    return typeof stored === "boolean" ? stored : defaultOpen === true;
  }

  function catalogViewState({
    scrollLeft = 0,
    scrollTop = 0,
    activeElementId = "",
    selectionStart = null,
    selectionEnd = null,
  } = {}) {
    const restoreSearchFocus = activeElementId === "cpSearch";
    return {
      scrollLeft: Number.isFinite(Number(scrollLeft)) ? Number(scrollLeft) : 0,
      scrollTop: Number.isFinite(Number(scrollTop)) ? Number(scrollTop) : 0,
      restoreSearchFocus,
      selectionStart: restoreSearchFocus && Number.isInteger(selectionStart) ? selectionStart : null,
      selectionEnd: restoreSearchFocus && Number.isInteger(selectionEnd) ? selectionEnd : null,
    };
  }

  function manualPlacementWarnings({
    currentCredits = 0,
    incomingCredits = 0,
    prerequisiteBlocked = false,
    prerequisiteReason = "",
    standingBlocked = false,
    standingReason = "",
  } = {}) {
    const warnings = [];
    const resultingCredits = Number(currentCredits) + Number(incomingCredits);
    if (Number.isFinite(resultingCredits) && resultingCredits > 18) {
      warnings.push({
        kind: "credit_limit",
        reason: `This placement would bring the semester to ${resultingCredits} credits, above the standard 18-credit limit.`,
      });
    }
    if (prerequisiteBlocked) {
      warnings.push({
        kind: "prerequisite",
        reason: String(prerequisiteReason || "A reviewed prerequisite must be completed first."),
      });
    }
    if (standingBlocked) {
      warnings.push({
        kind: "standing",
        reason: String(standingReason || "A reviewed standing rule is not met in this semester."),
      });
    }
    return warnings;
  }

  function numericLabel(value) {
    const text = String(value ?? "").trim();
    return /^\d+$/.test(text) ? Number(text) : Number.POSITIVE_INFINITY;
  }

  function sortSections(sections = []) {
    return [...(Array.isArray(sections) ? sections : [])].sort((left, right) => (
      numericLabel(left?.section_number) - numericLabel(right?.section_number)
      || numericLabel(left?.index_number) - numericLabel(right?.index_number)
      || String(left?.section_number || "").localeCompare(String(right?.section_number || ""))
      || String(left?.index_number || "").localeCompare(String(right?.index_number || ""))
    ));
  }

  function calendarBlockGeometry({
    startMinute,
    endMinute,
    dayStartMinute = 480,
    pixelsPerMinute = 0.8,
  } = {}) {
    const start = Number(startMinute);
    const end = Number(endMinute);
    const dayStart = Number(dayStartMinute);
    const scale = Number(pixelsPerMinute);
    if (![start, end, dayStart, scale].every(Number.isFinite) || end <= start || scale <= 0) return null;
    return {
      top: (start - dayStart) * scale,
      height: (end - start) * scale,
    };
  }

  root.ScheduleRUCourseInteractionLogic = {
    mergeCourseRecords,
    courseNumber,
    selectedCourseCodes,
    requirementSelectionAction,
    expansionOpen,
    catalogViewState,
    manualPlacementWarnings,
    sortSections,
    calendarBlockGeometry,
  };
})(globalThis);
