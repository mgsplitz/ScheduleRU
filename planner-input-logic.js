/*
 * Pure requirement-tree to four-year-planner adapter. It preserves the
 * distinction between concrete required courses, user choices, optional
 * wishlist courses, and academic facts that still need review.
 */
(function exposePlannerInputLogic(root) {
  const DEFAULT_ESTIMATED_CREDITS = 3;
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;

  const text = (value) => String(value ?? "").trim();
  const unique = (values) => [...new Set(values)];
  const validCode = (value) => COURSE_CODE.test(text(value));

  function numericCredits(value) {
    const match = text(value).match(/\d+(?:\.\d+)?/);
    const number = match ? Number(match[0]) : NaN;
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function standingFromText(course) {
    const value = [course?.restrictions, ...(course?.requirementNotes || [])].map(text).join(" ").toLowerCase();
    if (/seniors?\s+(?:year|standing|status|only)|4th\s+year/.test(value)) return 4;
    if (/juniors?\s*(?:\/|or|and|-)?\s*seniors?|juniors?\s+(?:year|standing|status)|3rd\s+year/.test(value)) return 3;
    if (/all\s+except\s+(?:1st|first)[ -]?year|not\s+open\s+to\s+(?:1st|first)[ -]?year|except\s+(?:1st|first)[ -]?year/.test(value)) return 2;
    return null;
  }

  function normalizedEligibility(course) {
    const logic = root.ScheduleRUEligibilityLogic;
    const payload = course?.eligibility;
    const rawConditions = Array.isArray(payload?.conditions) ? payload.conditions : [];
    const conditions = rawConditions.map((condition) => logic?.normalizeCondition(condition)).filter(Boolean);
    const reviewed = payload?.review?.review_status === "reviewed" && conditions.length === rawConditions.length;
    const reviewedPaths = reviewed ? (logic?.prerequisitePathsFromConditions(rawConditions) || []) : [];
    const directPaths = Array.isArray(course?.prerequisiteCodes) && course.prerequisiteCodes.length
      ? [course.prerequisiteCodes.filter(validCode)]
      : [];
    const catalog = logic?.parseCatalogPrerequisitePaths(course?.catalogPrereqs || "") || { reviewable: false, paths: [] };
    const paths = reviewedPaths.length ? reviewedPaths : directPaths[0]?.length ? directPaths : catalog.reviewable ? catalog.paths : [];
    const minimumYearCondition = conditions.find((condition) => condition.type === "minimum_plan_year");
    const priorCreditsCondition = conditions.find((condition) => condition.type === "minimum_prior_credits");
    const corequisiteConditions = conditions.filter((condition) => condition.type === "corequisite_course");
    return {
      prerequisitePaths: paths,
      minimumPlanYear: minimumYearCondition?.minimum_year || standingFromText(course),
      minimumPriorCredits: priorCreditsCondition?.minimum_credits ?? null,
      corequisitePaths: corequisiteConditions.map((condition) => condition.any_of_course_codes),
      ruleCoverage: reviewed ? "reviewed" : catalog.reviewable || standingFromText(course) ? "catalog_parsed" : "unresolved",
    };
  }

  function normalizedCourse(course, { optional = false, prerequisiteOnly = false } = {}) {
    const listedCredits = numericCredits(course?.credits);
    const eligibility = normalizedEligibility(course);
    return {
      code: text(course?.code),
      title: text(course?.fullTitle || course?.title || course?.code),
      credits: listedCredits ?? DEFAULT_ESTIMATED_CREDITS,
      creditsEstimated: listedCredits === null,
      optional: optional === true,
      prerequisiteOnly: prerequisiteOnly === true,
      minimumPlanYear: eligibility.minimumPlanYear,
      minimumPriorCredits: eligibility.minimumPriorCredits,
      corequisitePaths: eligibility.corequisitePaths,
      ruleCoverage: eligibility.ruleCoverage,
      prerequisitePaths: eligibility.prerequisitePaths,
    };
  }

  function placeholder(group, sourceProgram, index, kind = "requirement_placeholder", courses = {}) {
    const credits = group.rule === "min_credits" ? Math.min(DEFAULT_ESTIMATED_CREDITS, Number(group.count) || DEFAULT_ESTIMATED_CREDITS) : DEFAULT_ESTIMATED_CREDITS;
    return {
      id: `planner-choice:${sourceProgram || "program"}:${group.id}:${index}`,
      kind,
      label: text(group.name) || "Unresolved requirement",
      credits,
      sourceType: sourceProgram === "core" ? "core" : "program",
      sourceProgram,
      requirementGroupId: group.id,
      candidateSelectionContext: {
        rule: group.rule,
        required: Number(group.count) || 1,
        members: [...(group.members || [])],
        memberCourseCodes: (group.members || []).map((id) => courses[id]?.code).filter(validCode),
        children: [...(group.children || [])],
        courseSelectors: [...(group.courseSelectors || [])],
        sourceProgramIds: [...(group.sourceProgramIds || [])],
      },
    };
  }

  function requirementInputs(tree, sourceProgram, groupSelections, completed) {
    const concrete = new Map();
    const placeholders = [];
    const courses = tree?.courses || {};
    const groups = tree?.groups || {};

    const addCourse = (id) => {
      const course = courses[id];
      if (!validCode(course?.code) || completed.has(course.code)) return;
      concrete.set(course.code, course);
    };

    function visit(groupId) {
      const group = groups[groupId];
      if (!group) return;
      const selected = (Array.isArray(groupSelections?.[group.id]) ? groupSelections[group.id] : [])
        .filter((id) => group.members?.includes(id) || group.children?.includes(id));

      const groupProgram = text(group.sourceProgramId) || sourceProgram;
      if (group.rule === "one_of") {
        const selectedChild = selected.find((id) => group.children?.includes(id));
        if (selectedChild) visit(selectedChild);
        else placeholders.push(placeholder(group, groupProgram, 0, "choice_placeholder", courses));
        return;
      }

      if (["min", "min_courses", "min_credits", "distinct"].includes(group.rule)) {
        const selectedMembers = selected.filter((id) => group.members?.includes(id));
        const selectedChildren = selected.filter((id) => group.children?.includes(id));
        const satisfiedMembers = (group.members || []).filter((id) => completed.has(courses[id]?.code));
        const fulfilledMembers = unique([...selectedMembers, ...satisfiedMembers]);
        selectedMembers.forEach(addCourse);
        selectedChildren.forEach(visit);
        const remaining = group.rule === "min_credits"
          ? Math.max(0, Math.ceil((
            Math.max(DEFAULT_ESTIMATED_CREDITS, Number(group.count) || DEFAULT_ESTIMATED_CREDITS)
            - fulfilledMembers.reduce((sum, id) => sum + (numericCredits(courses[id]?.credits) || DEFAULT_ESTIMATED_CREDITS), 0)
            - selectedChildren.length * DEFAULT_ESTIMATED_CREDITS
          ) / DEFAULT_ESTIMATED_CREDITS))
          : Math.max(0, Math.max(1, Number(group.count) || 1) - fulfilledMembers.length - selectedChildren.length);
        for (let index = 0; index < remaining; index += 1) {
          placeholders.push(placeholder(group, groupProgram, index, "requirement_placeholder", courses));
        }
        // Children of a choice group partition or refine the approved option
        // pool. They are not additional mandatory groups. Visiting every
        // child here turns hundreds of Core-approved alternatives into
        // required courses (notably the four Arts & Humanities goal pools).
        return;
      } else if (!['max', 'max_credits'].includes(group.rule)) {
        (group.members || []).forEach(addCourse);
      }

      (group.children || []).forEach(visit);
    }

    (tree?.roots || []).forEach(visit);
    return { courses: [...concrete.values()], placeholders };
  }

  function buildPlannerInput(input = {}) {
    const trees = (Array.isArray(input.requirementTrees) ? input.requirementTrees : [])
      .filter((entry) => entry?.tree);
    const academicCredit = root.ScheduleRUAcademicCredit;
    if (!academicCredit?.satisfiedCourseCodes) {
      throw new Error("ScheduleRUAcademicCredit must load before planner-input-logic.js");
    }
    const completed = academicCredit.satisfiedCourseCodes({
      confirmedCourseCodes: input.completedCourseCodes || [],
      requirementTrees: [...trees.map((entry) => entry.tree), input.coreTree].filter(Boolean),
    });
    const scheduleEntries = Object.values(input.schedule || {}).filter((entry) => validCode(entry?.code));
    const requirementTreeValues = [...trees.map((entry) => entry.tree), input.coreTree].filter(Boolean);
    const satisfiedForRequirements = academicCredit.satisfiedCourseCodes({
      confirmedCourseCodes: [...completed, ...scheduleEntries.map((entry) => entry.code)],
      requirementTrees: requirementTreeValues,
    });

    const requirementCourses = new Map();
    const unresolvedRequirements = [];
    trees.forEach(({ id, tree }) => {
      const result = requirementInputs(tree, id, input.groupSelections || {}, satisfiedForRequirements);
      result.courses.forEach((course) => requirementCourses.set(course.code, course));
      unresolvedRequirements.push(...result.placeholders);
    });

    if (input.coreTree) {
      const result = requirementInputs(input.coreTree, "core", input.groupSelections || {}, satisfiedForRequirements);
      result.courses.forEach((course) => requirementCourses.set(course.code, course));
      unresolvedRequirements.push(...result.placeholders);
    }

    academicCredit.redundantCanonicalCourseCodes({
      courseCodes: [...requirementCourses.keys()],
      requirementTrees: requirementTreeValues,
    }).forEach((code) => requirementCourses.delete(code));

    const normalizedByCode = new Map();
    requirementCourses.forEach((course) => normalizedByCode.set(course.code, normalizedCourse(course)));

    // A required downstream course may depend on one option from an unresolved
    // reviewed choice group. Promote the first complete, deterministic path
    // whose course records are already present in the selected requirement
    // trees. Consuming the matching placeholder prevents the same choice from
    // being counted twice in the generated plan.
    const availableTreeCourses = new Map();
    requirementTreeValues.forEach((tree) => {
      Object.values(tree.courses || {}).forEach((course) => {
        if (validCode(course?.code) && !availableTreeCourses.has(course.code)) {
          availableTreeCourses.set(course.code, course);
        }
      });
    });
    const treeCourseCodes = new Set(availableTreeCourses.keys());
    scheduleEntries.forEach((entry) => {
      if (completed.has(entry.code)) return;
      const satisfiesTreeCourse = [...academicCredit.satisfiedCourseCodes({
        confirmedCourseCodes: [entry.code],
        requirementTrees: requirementTreeValues,
      })].some((code) => treeCourseCodes.has(code));
      if (!satisfiesTreeCourse || normalizedByCode.has(entry.code)) return;
      const course = entry.course || entry;
      normalizedByCode.set(entry.code, normalizedCourse({
        ...course,
        code: entry.code,
        credits: entry.credits,
        title: entry.fullTitle || entry.title,
      }));
    });
    const prerequisiteQueue = [...normalizedByCode.keys()].sort();
    const prerequisiteVisited = new Set();
    while (prerequisiteQueue.length) {
      const code = prerequisiteQueue.shift();
      if (prerequisiteVisited.has(code)) continue;
      prerequisiteVisited.add(code);
      const course = normalizedByCode.get(code);
      const paths = course?.prerequisitePaths || [];
      const path = paths.find((candidate) => candidate.every((prerequisiteCode) =>
        completed.has(prerequisiteCode)
        || normalizedByCode.has(prerequisiteCode)
        || availableTreeCourses.has(prerequisiteCode)));
      if (!path) continue;
      path.forEach((prerequisiteCode) => {
        if (completed.has(prerequisiteCode) || normalizedByCode.has(prerequisiteCode)) return;
        const prerequisite = availableTreeCourses.get(prerequisiteCode);
        if (!prerequisite) return;
        const placeholderIndex = unresolvedRequirements.findIndex((item) =>
          item.candidateSelectionContext?.memberCourseCodes?.includes(prerequisiteCode));
        const fulfillsChoice = placeholderIndex >= 0;
        if (fulfillsChoice) unresolvedRequirements.splice(placeholderIndex, 1);
        normalizedByCode.set(prerequisiteCode, normalizedCourse(prerequisite, {
          prerequisiteOnly: !fulfillsChoice,
        }));
        prerequisiteQueue.push(prerequisiteCode);
      });
      prerequisiteQueue.sort();
    }

    (input.wishlistCourses || []).forEach((course) => {
      if (validCode(course?.code) && !completed.has(course.code) && !normalizedByCode.has(course.code)) {
        normalizedByCode.set(course.code, normalizedCourse(course, { optional: true }));
      }
    });
    Object.values(input.schedule || {}).forEach((entry) => {
      const course = entry?.course || entry;
      const explicitlyPinned = entry?.userPinned === true || entry?.locked === true;
      if (explicitlyPinned && validCode(entry?.code) && !completed.has(entry.code) && !normalizedByCode.has(entry.code)) {
        normalizedByCode.set(entry.code, normalizedCourse({ ...course, code: entry.code, credits: entry.credits, title: entry.fullTitle || entry.title }));
      }
    });

    const prerequisitePathsByCode = {};
    normalizedByCode.forEach((course) => {
      if (course.prerequisitePaths.length) prerequisitePathsByCode[course.code] = course.prerequisitePaths;
    });

    const issues = [...normalizedByCode.values()].filter((course) => course.creditsEstimated).map((course) => ({
      code: "estimated_course_credits",
      severity: "warning",
      courseCode: course.code,
      estimatedCredits: course.credits,
    }));

    const lockedPlacements = Object.fromEntries(Object.values(input.schedule || {})
      .filter((entry) => (entry?.userPinned === true || entry?.locked === true) && validCode(entry?.code))
      .map((entry) => [entry.code, { ...entry, locked: true, userPinned: true }]));

    return {
      terms: Array.isArray(input.terms) ? input.terms : [],
      courses: [...normalizedByCode.values()].sort((left, right) => left.code.localeCompare(right.code)),
      completedCourseCodes: [...completed].sort(),
      lockedPlacements,
      prerequisitePathsByCode,
      unresolvedRequirements,
      confirmedCredits: Number.isFinite(Number(input.confirmedCredits)) ? Math.max(0, Number(input.confirmedCredits)) : 0,
      issues,
    };
  }

  root.ScheduleRUPlannerInput = { buildPlannerInput, numericCredits, standingFromText, normalizedCourse };
})(globalThis);
