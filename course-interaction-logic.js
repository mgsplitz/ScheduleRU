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

  const COURSE_SEARCH_ALIASES = new Map([
    ["intro", "introduction"],
    ["comp", "computer"],
    ["sci", "science"],
    ["biz", "business"],
  ]);
  const COURSE_SEARCH_STOP_WORDS = new Set(["a", "an", "and", "for", "of", "the", "to"]);

  function normalizedCourseSearchText(value) {
    return String(value || "").toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => COURSE_SEARCH_ALIASES.get(token) || token)
      .join(" ");
  }

  function editDistance(left, right) {
    const a = String(left || "");
    const b = String(right || "");
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const replaced = previous + (a[i - 1] === b[j - 1] ? 0 : 1);
        previous = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, replaced);
      }
    }
    return row[b.length];
  }

  function tokenSimilarity(queryToken, courseToken) {
    if (queryToken === courseToken) return 1;
    if (courseToken.startsWith(queryToken) || queryToken.startsWith(courseToken)) return 0.92;
    const longest = Math.max(queryToken.length, courseToken.length);
    if (!longest) return 0;
    return 1 - (editDistance(queryToken, courseToken) / longest);
  }

  function onboardingCourseMatchScore(course, query) {
    const rawQuery = String(query || "").trim().toLowerCase();
    const rawCode = String(course?.code || "").trim().toLowerCase();
    if (!rawQuery || !rawCode) return 0;
    if (rawCode === rawQuery) return 100;
    if (rawCode.includes(rawQuery)) return 20;
    const normalizedQuery = normalizedCourseSearchText(rawQuery);
    const normalizedTitle = normalizedCourseSearchText(course?.fullTitle || course?.title);
    if (!normalizedQuery || !normalizedTitle) return 0;
    if (normalizedTitle === normalizedQuery) return 50;
    if (normalizedTitle.includes(normalizedQuery)) return 30 + (normalizedQuery.length / normalizedTitle.length);
    const queryTokens = normalizedQuery.split(" ").filter((token) => !COURSE_SEARCH_STOP_WORDS.has(token));
    const titleTokens = normalizedTitle.split(" ").filter((token) => !COURSE_SEARCH_STOP_WORDS.has(token));
    if (!queryTokens.length || !titleTokens.length) return 0;
    const similarities = queryTokens.map((queryToken) => (
      Math.max(...titleTokens.map((titleToken) => tokenSimilarity(queryToken, titleToken)))
    ));
    const coverage = similarities.filter((value) => value >= 0.68).length / queryTokens.length;
    return coverage < 0.6 ? 0 : 10 + similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
  }

  function rankOnboardingCourseMatches(courses = [], query = "") {
    return [...new Map((Array.isArray(courses) ? courses : [])
      .filter((course) => course?.code)
      .map((course) => [course.code, course])).values()]
      .map((course, index) => ({ course, index, score: onboardingCourseMatchScore(course, query) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((entry) => entry.course);
  }

  function onboardingCatalogSearchTerms(query = "") {
    const raw = String(query || "").trim();
    if (!raw) return [];
    if (/^\d{2}:\d{3}:\d{3}$/.test(raw)) return [raw];
    const tokens = [...new Set(raw.toLowerCase().match(/[a-z0-9]+/g) || [])]
      .filter((token) => token.length >= 4 && !COURSE_SEARCH_STOP_WORDS.has(token))
      .sort((left, right) => right.length - left.length || right.localeCompare(left));
    return [raw, ...tokens].slice(0, 4);
  }

  function verifiedOnboardingCourse(courses = [], query = "") {
    const match = rankOnboardingCourseMatches(courses, query)[0] || null;
    return match && onboardingCourseMatchScore(match, query) >= 10.68 ? match : null;
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
    rankOnboardingCourseMatches,
    onboardingCatalogSearchTerms,
    verifiedOnboardingCourse,
  };
})(globalThis);
