/*
 * Academic progress orchestration shared by the four-year planner and browser
 * compatibility layer. This module turns device-local academic history into
 * the normalized evidence consumed by requirement and eligibility logic.
 */
(function exposeAcademicProgressModel(root) {
  const academicCredit = root.ScheduleRUAcademicCredit;
  const eligibilityLogic = root.ScheduleRUEligibilityLogic;

  function creditNumber(value) {
    const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
    const number = Number(match?.[0]);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function create({
    getState,
    getApAwards,
    getRequirementTrees,
    courseRecordFromId,
    courseCodesFromText,
  } = {}) {
    function state() {
      return getState?.() || {};
    }

    function requirementTrees() {
      return (getRequirementTrees?.() || []).filter(Boolean);
    }

    function confirmedCreditEntries() {
      const current = state();
      const entries = [];

      (getApAwards?.() || [])
        .filter((award) => current.apOn?.[award.id])
        .forEach((award) => {
          const equivalentCourseCodes = [...new Set([
            ...(courseCodesFromText?.(award.equiv) || []),
            ...(award.fulfills || [])
              .map((value) => academicCredit.normalizeCourseCode(value))
              .filter(Boolean),
          ])];
          entries.push({
            id: `ap:${award.id}`,
            source: "ap",
            credits: creditNumber(award.credits),
            course_code: equivalentCourseCodes[0] || "",
            equivalent_course_codes: equivalentCourseCodes,
          });
        });

      Object.entries(current.completed || {}).forEach(([id, taken]) => {
        if (!taken) return;
        const course = courseRecordFromId?.(id);
        if (!course) return;
        entries.push({
          id: `completed:${id}`,
          source: "rutgers_completed",
          credits: creditNumber(course.credits),
          course_code: course.code,
        });
      });

      Object.values(current.creditLedger || {}).forEach((entry) => entries.push(entry));
      return eligibilityLogic.confirmedCreditEntries(entries);
    }

    function resolvedCourseCodes(codes) {
      return [...academicCredit.satisfiedCourseCodes({
        confirmedCourseCodes: codes,
        requirementTrees: requirementTrees(),
      })];
    }

    function confirmedCourseCodes(entries = confirmedCreditEntries()) {
      return resolvedCourseCodes(
        (entries || []).flatMap((entry) => eligibilityLogic.entryCourseCodes(entry)),
      );
    }

    function scheduledCreditEntries() {
      const entries = Object.values(state().schedule || {}).map((entry) => ({
        id: `scheduled:${entry.code}`,
        course_code: entry.code,
        credits: creditNumber(entry.credits),
        year: Number(entry.year),
        sem: entry.sem,
      }));
      return academicCredit.expandedPlannedCourseEntries({
        entries,
        requirementTrees: requirementTrees(),
      });
    }

    function eligibilityPayload(course) {
      return course?.eligibility || state().courseEligibilityByCode?.[course?.code] || null;
    }

    function eligibilityForTerm(course, term, overrides = {}) {
      const payload = eligibilityPayload(course);
      return eligibilityLogic.evaluateEligibility({
        targetTerm: term,
        mode: "plan",
        review: payload?.review,
        conditions: payload?.conditions || [],
        confirmedEntries: overrides.confirmedEntries ?? confirmedCreditEntries(),
        scheduledEntries: overrides.scheduledEntries ?? scheduledCreditEntries(),
      });
    }

    function reviewedEligibility(course) {
      const payload = eligibilityPayload(course);
      return payload?.review?.review_status === "reviewed" ? payload : null;
    }

    return {
      confirmedCreditEntries,
      resolvedCourseCodes,
      confirmedCourseCodes,
      scheduledCreditEntries,
      eligibilityForTerm,
      reviewedEligibility,
    };
  }

  root.ScheduleRUAcademicProgressModel = { creditNumber, create };
})(globalThis);
