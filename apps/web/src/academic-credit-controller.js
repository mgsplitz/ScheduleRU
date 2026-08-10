(function (root) {
  "use strict";

  function create(options = {}) {
    const {
      baseConfirmedEntries = () => [],
      additionalConfirmedEntries = () => [],
      baseIsCompleted = () => false,
      additionalCompletedCourseCodes = () => [],
      courseCodeForId = (id) => id,
      normalizeCourseId = (code) => String(code || ""),
    } = options;

    function confirmedEntries() {
      return [
        ...(baseConfirmedEntries() || []),
        ...(additionalConfirmedEntries() || []),
      ];
    }

    function isCompleted(id) {
      if (baseIsCompleted(id)) return true;
      const target = normalizeCourseId(courseCodeForId(id));
      return (additionalCompletedCourseCodes() || []).some(
        (code) => normalizeCourseId(code) === target,
      );
    }

    return { confirmedEntries, isCompleted };
  }

  root.ScheduleRUAcademicCreditController = { create };
})(typeof globalThis !== "undefined" ? globalThis : window);
