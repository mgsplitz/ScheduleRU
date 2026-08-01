(function exposePlannerStateLogic(root) {
  const STATE_VERSION = 5;
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
  const termKey = (term) => `${Number(term?.year)}:${String(term?.sem || "").toLowerCase()}`;

  function normalizeAcademicPosition(position = {}) {
    const year = Number(position.year);
    return {
      year: Number.isInteger(year) && year >= 1 && year <= 4 ? year : 1,
      startingSemester: position.startingSemester === "spring" ? "spring" : "fall",
    };
  }

  function deriveAcademicCalendarStartYear(position, activeYear) {
    const year = Number(position?.year);
    const calendarYear = Number(activeYear);
    if (!Number.isInteger(year) || year < 1 || year > 4 || !Number.isInteger(calendarYear)) return null;
    return calendarYear - (year - 1) - (position?.startingSemester === "spring" ? 1 : 0);
  }

  function calendarYearForPlanTerm(academicCalendarStartYear, year, sem) {
    const anchor = Number(academicCalendarStartYear);
    const academicYear = Number(year);
    const semester = String(sem || "").toLowerCase();
    if (!Number.isInteger(anchor) || !Number.isInteger(academicYear) || academicYear < 1 || !["fall", "spring"].includes(semester)) return null;
    return anchor + academicYear - 1 + (semester === "spring" ? 1 : 0);
  }

  function lockedPlacementsForTerms(schedule, terms) {
    const termKeys = new Set((Array.isArray(terms) ? terms : []).map(termKey));
    return Object.fromEntries(Object.values(schedule && typeof schedule === "object" ? schedule : {})
      .filter((entry) => entry?.userPinned === true && termKeys.has(termKey(entry)))
      .map((entry) => [entry.code, { ...entry, locked: true, userPinned: true }])
      .filter(([code]) => typeof code === "string" && code));
  }

  function normalizeAcademicRecord(record = {}) {
    const type = ["ap", "rutgers_completed", "transfer"].includes(record.type) ? record.type : "transfer";
    const score = type === "ap" ? Number(record.score) : null;
    const equivalencyReviewStatus = record.equivalencyReviewStatus === "reviewed" ? "reviewed" : "";
    const equivalentCourseCodes = Array.isArray(record.equivalentCourseCodes) ? [...new Set(record.equivalentCourseCodes.filter((code) => COURSE_CODE.test(code)))] : [];
    const reviewedAppliedAp = type === "ap" && record.creditStatus === "applied" && equivalencyReviewStatus === "reviewed" && equivalentCourseCodes.length > 0;
    return {
      id: String(record.id || `${type}:${Date.now()}`),
      type,
      exam: String(record.exam || "").trim(),
      score: Number.isFinite(score) ? score : null,
      courseCode: COURSE_CODE.test(String(record.courseCode || "")) ? String(record.courseCode) : "",
      title: String(record.title || "").trim(),
      credits: Math.max(0, Number(record.credits) || 0),
      grade: String(record.grade || "").trim(),
      completedTerm: String(record.completedTerm || "").trim(),
      creditStatus: type === "ap" ? (score >= 4 ? (reviewedAppliedAp ? "applied" : "review_required") : "not_applied") : "applied",
      equivalencyReviewStatus,
      equivalentCourseCodes,
    };
  }

  function migratePlannerState(raw = {}) {
    const state = clone(raw);
    state.version = STATE_VERSION;
    state.onboarding ||= { completed: false, step: 0 };
    state.academicPosition = normalizeAcademicPosition(state.academicPosition);
    const anchor = Number(state.academicCalendarStartYear);
    state.academicCalendarStartYear = Number.isInteger(anchor) ? anchor : null;
    state.academicRecords = (Array.isArray(state.academicRecords) ? state.academicRecords : []).map(normalizeAcademicRecord);
    state.primaryProgramId ??= state.selectedProgramIds?.[0] ?? null;
    state.secondaryProgramId ??= state.selectedProgramIds?.[1] ?? null;
    state.schedule ||= {};
    Object.values(state.schedule).forEach((entry) => {
      if (!entry) return;
      if (entry.userPinned === undefined) entry.userPinned = entry.locked !== false;
      entry.userPinned = entry.userPinned === true;
      entry.locked = entry.userPinned;
    });
    state.planPlaceholders = Array.isArray(state.planPlaceholders) ? state.planPlaceholders : [];
    state.generatedPlanPreview ??= null;
    state.schedulePreferences ||= {};
    state.issueDismissals ||= {};
    return state;
  }

  function academicCreditEntries(state) {
    return (state?.academicRecords || []).filter((record) => record.creditStatus === "applied").map((record) => ({
      id: record.id,
      source: record.type,
      credits: record.credits,
      course_code: record.courseCode,
      equivalent_course_codes: record.equivalentCourseCodes,
    }));
  }

  const preferencesForTerm = (state, term) => clone(state?.schedulePreferences?.[termKey(term)] || { version: 1, constraints: [], messages: [] });
  function withAcceptedPlan(state, preview) {
    const schedule = {};
    Object.entries(clone(preview?.schedule || {})).forEach(([code, entry]) => {
      schedule[code] = { ...entry, locked: false, userPinned: false };
    });
    Object.values(state?.schedule || {}).filter((entry) => entry?.userPinned === true && entry?.code).forEach((entry) => {
      schedule[entry.code] = { ...clone(entry), locked: true, userPinned: true };
    });
    return {
      ...state,
      schedule,
      planPlaceholders: clone(Array.isArray(preview?.placeholders) ? preview.placeholders : []),
      generatedPlanPreview: null,
    };
  }

  root.ScheduleRUPlannerStateLogic = {
    STATE_VERSION, migratePlannerState, normalizeAcademicRecord, academicCreditEntries, termKey,
    preferencesForTerm, withAcceptedPlan, deriveAcademicCalendarStartYear, calendarYearForPlanTerm,
    lockedPlacementsForTerms,
  };
})(globalThis);
