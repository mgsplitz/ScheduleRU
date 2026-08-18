/*
 * Browser course-record composition. Requirement, catalog, saved, and planned
 * records enter with different shapes; this model exposes one stable shape and
 * keeps course-code identity consistent across those views.
 */
(function exposeCourseRecordModel(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const interactionLogic = root.ScheduleRUCourseInteractionLogic;

  function create({
    getState,
    getRequirementCourses,
    cleanText,
    saveState,
  } = {}) {
    function state() {
      return getState?.() || {};
    }

    function requirementCourses() {
      return getRequirementCourses?.() || {};
    }

    function catalogCourseCode(course) {
      return course?.code
        || [course?.school, course?.subject_code, course?.course_number]
          .filter(Boolean)
          .join(":");
    }

    function requirementCourseRecord(id) {
      const course = requirementCourses()[id];
      if (!course) return null;
      return {
        id,
        code: course.code,
        title: course.title || course.fullTitle || course.code,
        fullTitle: course.fullTitle || course.title || course.code,
        credits: course.credits ?? "",
        description: course.description || "",
        catalogPrereqs: course.catalogPrereqs || "",
        subjectNotes: course.subjectNotes || "",
        restrictions: course.restrictions || "",
        requirementNotes: course.requirementNotes || [],
        prereqs: Array.isArray(course.prereqs) ? course.prereqs : [],
        alternatives: Array.isArray(course.alternatives) ? course.alternatives : [],
        requirementId: id,
        eligibility: course.eligibility || null,
        catalogRecordAvailable: course.catalogRecordAvailable === true,
      };
    }

    function backendCourseRecord(course) {
      if (!course) return null;
      const code = catalogCourseCode(course);
      if (!code) return null;
      const current = state();
      const title = cleanText?.(course.title) || code;
      return {
        id: course.id || code,
        code,
        title,
        fullTitle: title,
        credits: course.credits ?? "",
        description: cleanText?.(course.description) || "",
        catalogPrereqs: cleanText?.(course.prereqs) || "",
        subjectNotes: cleanText?.(course.subject_notes) || "",
        restrictions: cleanText?.(course.restrictions) || "",
        requirementNotes: [],
        prereqs: [],
        attributes: Array.isArray(course.attributes) ? [...course.attributes] : [],
        eligibility: current.courseEligibilityByCode?.[code] || null,
        catalogRecordAvailable: true,
      };
    }

    function courseRecordFromId(reference) {
      const id = String(reference || "");
      const courses = requirementCourses();
      const current = state();
      const directRequirement = courses[id] ? requirementCourseRecord(id) : null;
      const requirementEntry = Object.entries(courses)
        .find(([, course]) => course.code === id);
      const requirement = requirementEntry
        ? requirementCourseRecord(requirementEntry[0])
        : directRequirement;
      const code = requirement?.code || (COURSE_CODE.test(id) ? id : "");
      const wishlist = Object.values(current.wishlist || {})
        .find((record) => record && typeof record === "object"
          && (record.code === code || record.id === id))
        || (current.wishlist?.[id] && typeof current.wishlist[id] === "object"
          ? current.wishlist[id]
          : null);
      const scheduled = Object.values(current.schedule || {})
        .find((entry) => entry?.code === code || entry?.course?.id === id);
      const catalog = (current.backendCourses || [])
        .find((course) => course.id === id || catalogCourseCode(course) === (code || id));
      const merged = interactionLogic.mergeCourseRecords([
        requirement,
        scheduled?.course,
        scheduled,
        wishlist,
        backendCourseRecord(catalog),
      ]);
      if (merged.code) return merged;
      return COURSE_CODE.test(id) ? {
        id,
        code: id,
        title: id,
        fullTitle: id,
        credits: "",
        description: "",
        catalogPrereqs: "",
        subjectNotes: "",
        restrictions: "",
        requirementNotes: [],
        prereqs: [],
        catalogRecordAvailable: false,
      } : null;
    }

    function addToWishlist(reference, explicitRecord = null) {
      const current = state();
      const record = explicitRecord || courseRecordFromId(reference);
      if (!record?.code) return;
      current.wishlist ||= {};
      current.wishlist[record.code] = interactionLogic.mergeCourseRecords([
        current.wishlist[record.code],
        record,
        { id: record.id || record.code, code: record.code },
      ]);
      saveState?.();
    }

    function wishlistRecords() {
      const seen = new Set();
      return Object.entries(state().wishlist || {}).map(([key, value]) => {
        const record = value && typeof value === "object"
          ? value
          : courseRecordFromId(key);
        return record?.code ? { ...record, key } : null;
      }).filter((record) => record && !seen.has(record.code) && seen.add(record.code));
    }

    return {
      catalogCourseCode,
      requirementCourseRecord,
      backendCourseRecord,
      courseRecordFromId,
      addToWishlist,
      wishlistRecords,
    };
  }

  root.ScheduleRUCourseRecordModel = { create };
})(globalThis);
