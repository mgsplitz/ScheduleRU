/*
 * Pure prerequisite-path orchestration. Low-level parsing and evaluation stay
 * in eligibility-logic; this model selects the authoritative source and joins
 * it with caller-provided course records and planning evidence.
 */
(function exposeCoursePathModel(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const eligibilityLogic = root.ScheduleRUEligibilityLogic;

  function create({
    getCourseById,
    getCourseByCode,
    getEligibilityForCourse,
    getConfirmedCourseCodes,
    getScheduledEntries,
  } = {}) {
    function directPrerequisiteCodes(course) {
      return [...new Set((Array.isArray(course?.prereqs) ? course.prereqs : [])
        .map((id) => getCourseById?.(id)?.code)
        .filter((code) => COURSE_CODE.test(String(code || ""))))];
    }

    function planForCourse(course) {
      const parsed = eligibilityLogic.parseCatalogPrerequisitePaths(
        course?.catalogPrereqs || "",
      );
      const catalogPaths = eligibilityLogic.campusRelevantPrerequisitePaths({
        courseCode: course?.code,
        paths: parsed.paths,
      });
      const eligibility = getEligibilityForCourse?.(course) || null;
      const reviewedPaths = eligibilityLogic.prerequisitePathsFromConditions(
        eligibility?.conditions || [],
      );
      const verifiedNoPrerequisites = eligibility?.review?.review_status === "reviewed"
        && Number(eligibility?.review?.no_known_conditions) === 1
        && !reviewedPaths.length;
      const direct = directPrerequisiteCodes(course);
      const references = new Map(
        (parsed.references || []).map((reference) => [reference.course_code, reference]),
      );

      [...direct, ...reviewedPaths.flat()].forEach((code) => {
        const known = getCourseByCode?.(code);
        if (!references.has(code)) {
          references.set(code, {
            course_code: code,
            title: known?.fullTitle || known?.title || "",
          });
        }
      });

      if (reviewedPaths.length) {
        return {
          reviewable: true,
          paths: reviewedPaths,
          references: [...references.values()],
          source: "reviewed_conditions",
          verifiedNoPrerequisites,
        };
      }
      if (direct.length) {
        return {
          reviewable: true,
          paths: [direct],
          references: [...references.values()],
          source: "reviewed_simple",
          verifiedNoPrerequisites,
        };
      }
      return {
        ...parsed,
        paths: catalogPaths,
        references: [...references.values()],
        source: parsed.reviewable ? "catalog" : "catalog_unreviewed",
        verifiedNoPrerequisites,
      };
    }

    function eligibilityForTerm(course, term) {
      const plan = planForCourse(course);
      const result = eligibilityLogic.evaluatePrerequisitePaths({
        targetTerm: term,
        paths: plan.paths,
        confirmedCourseCodes: getConfirmedCourseCodes?.() || [],
        scheduledEntries: getScheduledEntries?.() || [],
      });
      return { ...result, plan };
    }

    return {
      directPrerequisiteCodes,
      planForCourse,
      eligibilityForTerm,
    };
  }

  root.ScheduleRUCoursePathModel = { create };
})(globalThis);
