(function exposePlannerStateLogic(root) {
  const STATE_VERSION = 3;
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
  const termKey = (term) => `${Number(term?.year)}:${String(term?.sem || "").toLowerCase()}`;

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
    state.academicPosition ||= { year: 1, startingSemester: "fall" };
    state.academicRecords = (Array.isArray(state.academicRecords) ? state.academicRecords : []).map(normalizeAcademicRecord);
    state.primaryProgramId ??= state.selectedProgramIds?.[0] ?? null;
    state.secondaryProgramId ??= state.selectedProgramIds?.[1] ?? null;
    state.schedule ||= {};
    Object.values(state.schedule).forEach((entry) => { if (entry && entry.locked === undefined) entry.locked = true; });
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
    return { ...state, schedule: clone(preview?.schedule || {}), generatedPlanPreview: null };
  }

  root.ScheduleRUPlannerStateLogic = { STATE_VERSION, migratePlannerState, normalizeAcademicRecord, academicCreditEntries, termKey, preferencesForTerm, withAcceptedPlan };
})(globalThis);
