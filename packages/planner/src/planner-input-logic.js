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

  function normalizedEligibility(course, { knownCourseCodes, completedCourseCodes } = {}) {
    const logic = root.ScheduleRUEligibilityLogic;
    const payload = course?.eligibility;
    const rawConditions = Array.isArray(payload?.conditions) ? payload.conditions : [];
    const conditions = rawConditions.map((condition) => logic?.normalizeCondition(condition)).filter(Boolean);
    const reviewed = payload?.review?.review_status === "reviewed" && conditions.length === rawConditions.length;
    const reviewedNoConditions = reviewed
      && Number(payload?.review?.no_known_conditions) === 1
      && rawConditions.length === 0;
    const reviewedPaths = reviewed ? (logic?.prerequisitePathsFromConditions(rawConditions) || []) : [];
    const directPaths = Array.isArray(course?.prerequisiteCodes) && course.prerequisiteCodes.length
      ? [course.prerequisiteCodes.filter(validCode)]
      : [];
    const catalog = logic?.parseCatalogPrerequisitePaths(course?.catalogPrereqs || "") || { reviewable: false, paths: [] };
    const campusCatalogPaths = logic?.campusRelevantPrerequisitePaths
      ? logic.campusRelevantPrerequisitePaths({ courseCode: course?.code, paths: catalog.paths })
      : catalog.paths;
    const hasPlanningUniverse = knownCourseCodes && typeof knownCourseCodes.has === "function";
    const enforceableCatalogPaths = hasPlanningUniverse
      ? campusCatalogPaths.filter((path) => path.every((code) =>
        knownCourseCodes.has(code) || completedCourseCodes?.has?.(code)))
      : campusCatalogPaths;
    const prerequisitePaths = reviewedNoConditions
      ? []
      : reviewedPaths.length ? reviewedPaths : directPaths[0]?.length ? directPaths : catalog.reviewable ? campusCatalogPaths : [];
    const enforceablePrerequisitePaths = reviewedNoConditions
      ? []
      : reviewedPaths.length ? reviewedPaths : directPaths[0]?.length ? directPaths : catalog.reviewable ? enforceableCatalogPaths : [];
    const minimumYearCondition = conditions.find((condition) => condition.type === "minimum_plan_year");
    const priorCreditsCondition = conditions.find((condition) => condition.type === "minimum_prior_credits");
    const corequisiteConditions = conditions.filter((condition) => condition.type === "corequisite_course");
    return {
      prerequisitePaths,
      enforceablePrerequisitePaths,
      minimumPlanYear: minimumYearCondition?.minimum_year || standingFromText(course),
      minimumPriorCredits: priorCreditsCondition?.minimum_credits ?? null,
      corequisitePaths: corequisiteConditions.map((condition) => condition.any_of_course_codes),
      ruleCoverage: reviewed
        ? "reviewed"
        : enforceablePrerequisitePaths.length || standingFromText(course)
          ? "catalog_parsed"
          : "unresolved",
    };
  }

  function normalizedCourse(course, {
    optional = false,
    prerequisiteOnly = false,
    knownCourseCodes,
    completedCourseCodes,
  } = {}) {
    const listedCredits = numericCredits(course?.credits);
    const eligibility = normalizedEligibility(course, { knownCourseCodes, completedCourseCodes });
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
      enforceablePrerequisitePaths: eligibility.enforceablePrerequisitePaths,
    };
  }

  function parsedGroupSelectors(group) {
    return (group?.courseSelectors || []).map((entry) => {
      const raw = entry?.selector_json ?? entry;
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  function subsetConstraintChildren(group, groups) {
    const selectorLogic = root.ScheduleRUCourseSelectorLogic;
    const parentSelectors = parsedGroupSelectors(group);
    if (!selectorLogic?.selectorIsSubset || !parentSelectors.length || (group.members || []).length) return [];
    return (group.children || []).filter((childId) => {
      const child = groups[childId];
      const childSelectors = parsedGroupSelectors(child);
      return child
        && ["min", "min_courses"].includes(child.rule)
        && childSelectors.length
        && childSelectors.every((candidate) =>
          parentSelectors.some((parent) => selectorLogic.selectorIsSubset(candidate, parent)));
    });
  }

  function candidatePrerequisitePaths(group, courses, planningContext = {}, enforceable = false) {
    const memberCourses = (group.members || []).map((id) => courses[id]).filter((course) => validCode(course?.code));
    if (!memberCourses.length) return [];
    const pathsByCourse = memberCourses.map((course) => {
      const eligibility = normalizedEligibility(course, planningContext);
      return enforceable ? eligibility.enforceablePrerequisitePaths : eligibility.prerequisitePaths;
    });
    // A placeholder represents any valid candidate. Only publish a gate when
    // every finite candidate has at least one safely parsed path; otherwise a
    // no-prerequisite or unreviewed candidate could be incorrectly delayed.
    if (pathsByCourse.some((paths) => !paths.length)) return [];
    const seen = new Set();
    return pathsByCourse.flat().map((path) => path.filter(validCode)).filter((path) => {
      const key = path.join(",");
      if (!path.length || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function candidatePrerequisiteSummaries(group, courses, planningContext = {}, groups = {}) {
    return (group.members || []).flatMap((id) => {
      const course = courses[id];
      if (!validCode(course?.code)) return [];
      const equivalenceKey = text(course.equivalenceKey)
        || `requirement:${text(group.sourceProgramId)}:${course.code}`;
      return [course, ...(course.alternatives || []).map((alternative) => ({
        ...alternative,
        fullTitle: alternative.title,
        equivalenceKey,
        equivalentFor: course.code,
      }))].filter((candidate) => validCode(candidate?.code)).map((candidate) => {
        const eligibility = normalizedEligibility(candidate, planningContext);
        return {
          courseId: id,
          code: candidate.code,
          title: text(candidate.fullTitle || candidate.title || candidate.code),
          credits: numericCredits(candidate.credits) ?? DEFAULT_ESTIMATED_CREDITS,
          equivalenceKey,
          equivalentFor: text(candidate.equivalentFor) || null,
          prerequisitePaths: eligibility.prerequisitePaths,
          enforceablePrerequisitePaths: eligibility.enforceablePrerequisitePaths,
          minimumPlanYear: eligibility.minimumPlanYear,
          minimumPriorCredits: eligibility.minimumPriorCredits,
          ruleCoverage: eligibility.ruleCoverage,
          attributes: unique([
            ...(course.attributes || []),
            ...(group.rule === "distinct" ? (group.children || []).flatMap((childId) => {
              const child = groups[childId];
              if (!(child?.members || []).includes(id)) return [];
              const match = text(child.name).match(/\[([^\]]+)\]/);
              return match?.[1] && match[1] !== "AH" ? [match[1]] : [];
            }) : []),
          ]),
        };
      });
    }).sort((left, right) => left.code.localeCompare(right.code));
  }

  function placeholder(
    group,
    sourceProgram,
    sourceType,
    index,
    kind = "requirement_placeholder",
    courses = {},
    slot = {},
    planningContext = {},
    groups = {},
  ) {
    const credits = group.rule === "min_credits" ? Math.min(DEFAULT_ESTIMATED_CREDITS, Number(group.count) || DEFAULT_ESTIMATED_CREDITS) : DEFAULT_ESTIMATED_CREDITS;
    const total = Math.max(1, Number(slot.total) || 1);
    const position = Math.max(1, Number(slot.position) || index + 1);
    const groupLabel = text(slot.label) || text(group.name) || "Unresolved requirement";
    return {
      id: `planner-choice:${sourceProgram || "program"}:${group.id}:${index}`,
      kind,
      label: kind === "requirement_placeholder" && total > 1
        ? `Course ${position} of ${total} for ${groupLabel}`
        : groupLabel,
      credits,
      sourceType,
      sourceProgram,
      requirementGroupId: group.id,
      prerequisitePaths: candidatePrerequisitePaths(group, courses, planningContext),
      enforceablePrerequisitePaths: candidatePrerequisitePaths(group, courses, planningContext, true),
      candidateSelectionContext: {
        sourceType,
        sourceProgram,
        requirementGroupId: group.id,
        groupName: groupLabel,
        rule: group.rule,
        required: Number(group.count) || 1,
        members: [...(group.members || [])],
        memberCourseCodes: (group.members || []).map((id) => courses[id]?.code).filter(validCode),
        candidatePrerequisiteSummaries: candidatePrerequisiteSummaries(group, courses, planningContext, groups),
        children: [...(group.children || [])],
        courseSelectors: [...(group.courseSelectors || [])],
        sourceProgramIds: [...(group.sourceProgramIds || [])],
        allocationFamily: text(group.allocation?.allocation_family) || text(group.parentId) || null,
        distinctAttributes: unique(slot.distinctAttributes || []),
      },
    };
  }

  function requirementInputs(
    tree,
    sourceProgram,
    groupSelections,
    completed,
    excluded = completed,
    sourceType = sourceProgram === "core" ? "core" : "program",
    planningContext = {},
  ) {
    const concrete = new Map();
    const placeholders = [];
    const courses = tree?.courses || {};
    const groups = tree?.groups || {};

    function meaningfulGroupLabel(group) {
      const own = text(group?.name);
      if (!/^choose\s+\d+$/i.test(own)) return own || "Unresolved requirement";
      const parent = groups[group?.parentId];
      const parentName = text(parent?.name);
      return parentName ? `${parentName} option` : "Required course option";
    }

    const addCourse = (id) => {
      const course = courses[id];
      if (!validCode(course?.code) || excluded.has(course.code)) return;
      concrete.set(course.code, course);
    };

    function visit(groupId) {
      const group = groups[groupId];
      if (!group) return;
      const directSelected = (Array.isArray(groupSelections?.[group.id]) ? groupSelections[group.id] : [])
        .filter((id) => group.members?.includes(id) || group.children?.includes(id));
      const selectedFromDistinctChildren = group.rule === "distinct"
        ? (group.children || []).flatMap((childId) => {
          const child = groups[childId];
          return (Array.isArray(groupSelections?.[childId]) ? groupSelections[childId] : [])
            .filter((id) => child?.members?.includes(id) && group.members?.includes(id));
        })
        : [];
      const selected = unique([...directSelected, ...selectedFromDistinctChildren]);

      const groupProgram = text(group.sourceProgramId) || sourceProgram;
      if (group.rule === "one_of") {
        const selectedChild = selected.find((id) => group.children?.includes(id));
        if (selectedChild) visit(selectedChild);
        else placeholders.push(placeholder(
          group,
          groupProgram,
          sourceType,
          0,
          "choice_placeholder",
          courses,
          { label: meaningfulGroupLabel(group) },
          planningContext,
          groups,
        ));
        return;
      }

      if (["min", "min_courses", "min_credits", "distinct"].includes(group.rule)) {
        const selectedMembers = selected.filter((id) => group.members?.includes(id));
        const selectedChildren = selected.filter((id) => group.children?.includes(id));
        const subsetChildren = ["min", "min_courses"].includes(group.rule)
          ? subsetConstraintChildren(group, groups)
          : [];
        const selectedPartitionChildren = selectedChildren.filter((id) => !subsetChildren.includes(id));
        const satisfiedMembers = (group.members || []).filter((id) => completed.has(courses[id]?.code));
        const fulfilledMembers = unique([...selectedMembers, ...satisfiedMembers]);
        selectedMembers.forEach(addCourse);
        unique([...selectedChildren, ...subsetChildren]).forEach(visit);
        const subsetContribution = subsetChildren.reduce((sum, childId) => {
          const child = groups[childId];
          return sum + Math.max(1, Number(child?.count) || 1);
        }, 0);
        const childContribution = selectedPartitionChildren.length + subsetContribution;
        const required = Math.max(1, Number(group.count) || 1);
        const distinctCovered = group.rule === "distinct"
          ? new Set((group.children || []).filter((childId) => {
            const childMembers = new Set(groups[childId]?.members || []);
            return fulfilledMembers.some((id) => childMembers.has(id));
          })).size
          : 0;
        const remaining = group.rule === "min_credits"
          ? Math.max(0, Math.ceil((
            Math.max(DEFAULT_ESTIMATED_CREDITS, Number(group.count) || DEFAULT_ESTIMATED_CREDITS)
            - fulfilledMembers.reduce((sum, id) => sum + (numericCredits(courses[id]?.credits) || DEFAULT_ESTIMATED_CREDITS), 0)
            - selectedPartitionChildren.length * DEFAULT_ESTIMATED_CREDITS
          ) / DEFAULT_ESTIMATED_CREDITS))
          : group.rule === "distinct"
            ? Math.max(0, required - distinctCovered)
            : Math.max(0, required - fulfilledMembers.length - childContribution);
        for (let index = 0; index < remaining; index += 1) {
          placeholders.push(placeholder(
            group,
            groupProgram,
            sourceType,
            index,
            "requirement_placeholder",
            courses,
            {
              position: required - remaining + index + 1,
              total: required,
              label: meaningfulGroupLabel(group),
              distinctAttributes: group.rule === "distinct"
                ? (group.children || []).map((childId) => {
                  const match = text(groups[childId]?.name).match(/\[([^\]]+)\]/);
                  return text(match?.[1]);
                }).filter((attribute) => attribute && attribute !== "AH")
                : [],
            },
            planningContext,
            groups,
          ));
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
    // Regeneration is derived from requirements plus explicit user decisions.
    // Unlocked schedule entries are prior generated output, not fresh input;
    // feeding them back into requirement satisfaction makes obsolete
    // equivalents survive every subsequent generation.
    const pinnedScheduleEntries = Object.values(input.schedule || {}).filter((entry) =>
      validCode(entry?.code) && (entry?.userPinned === true || entry?.locked === true));
    const wishlistCourseCodes = (input.wishlistCourses || []).map((course) => course?.code).filter(validCode);
    const requirementTreeValues = [...trees.map((entry) => entry.tree), input.coreTree].filter(Boolean);
    const availableTreeCourses = new Map();
    requirementTreeValues.forEach((tree) => {
      Object.values(tree.courses || {}).forEach((course) => {
        if (validCode(course?.code) && !availableTreeCourses.has(course.code)) {
          availableTreeCourses.set(course.code, course);
        }
      });
    });
    const planningContext = {
      knownCourseCodes: new Set(availableTreeCourses.keys()),
      completedCourseCodes: completed,
    };
    const satisfiedForRequirements = academicCredit.satisfiedCourseCodes({
      confirmedCourseCodes: [
        ...completed,
        ...pinnedScheduleEntries.map((entry) => entry.code),
        ...wishlistCourseCodes,
      ],
      requirementTrees: requirementTreeValues,
    });

    function collectRequirements(satisfied) {
      const requirementCourses = new Map();
      const unresolvedRequirements = [];
      trees.forEach(({ id, tree }) => {
        const result = requirementInputs(
          tree,
          id,
          input.groupSelections || {},
          satisfied,
          satisfiedForRequirements,
          "program",
          planningContext,
        );
        result.courses.forEach((course) => requirementCourses.set(course.code, course));
        unresolvedRequirements.push(...result.placeholders);
      });
      if (input.coreTree) {
        const result = requirementInputs(
          input.coreTree,
          "core",
          input.groupSelections || {},
          satisfied,
          satisfiedForRequirements,
          "core",
          planningContext,
        );
        result.courses.forEach((course) => requirementCourses.set(course.code, course));
        unresolvedRequirements.push(...result.placeholders);
      }
      return { requirementCourses, unresolvedRequirements };
    }

    let { requirementCourses, unresolvedRequirements } = collectRequirements(satisfiedForRequirements);
    const plannedSatisfaction = academicCredit.satisfiedCourseCodes({
      confirmedCourseCodes: [
        ...satisfiedForRequirements,
        ...requirementCourses.keys(),
      ],
      requirementTrees: requirementTreeValues,
    });
    ({ requirementCourses, unresolvedRequirements } = collectRequirements(plannedSatisfaction));

    academicCredit.redundantCanonicalCourseCodes({
      courseCodes: [...requirementCourses.keys()],
      requirementTrees: requirementTreeValues,
    }).forEach((code) => requirementCourses.delete(code));

    const normalizedByCode = new Map();
    requirementCourses.forEach((course) => normalizedByCode.set(
      course.code,
      normalizedCourse(course, planningContext),
    ));

    // A required downstream course may depend on one option from an unresolved
    // reviewed choice group. Promote the first complete, deterministic path
    // whose course records are already present in the selected requirement
    // trees. Consuming the matching placeholder prevents the same choice from
    // being counted twice in the generated plan.
    const treeCourseCodes = new Set(availableTreeCourses.keys());
    function prerequisiteCanBePlanned(code, ancestors = new Set()) {
      if (completed.has(code) || normalizedByCode.has(code)) return true;
      if (ancestors.has(code)) return false;
      const course = availableTreeCourses.get(code);
      if (!course) return false;
      const paths = normalizedEligibility(course, planningContext).enforceablePrerequisitePaths;
      if (!paths.length) return true;
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(code);
      return paths.some((path) => path.every((prerequisiteCode) =>
        prerequisiteCanBePlanned(prerequisiteCode, nextAncestors)));
    }
    pinnedScheduleEntries.forEach((entry) => {
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
      }, planningContext));
    });
    const prerequisiteQueue = [...normalizedByCode.keys()].sort();
    const prerequisiteVisited = new Set();
    while (prerequisiteQueue.length) {
      const code = prerequisiteQueue.shift();
      if (prerequisiteVisited.has(code)) continue;
      prerequisiteVisited.add(code);
      const course = normalizedByCode.get(code);
      const paths = course?.prerequisitePaths || [];
      const path = paths.map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => candidate.every((prerequisiteCode) =>
          prerequisiteCanBePlanned(prerequisiteCode)))
        .sort((left, right) => {
          const newCourseCount = (candidate) => candidate.filter((prerequisiteCode) =>
            !completed.has(prerequisiteCode) && !normalizedByCode.has(prerequisiteCode)).length;
          return newCourseCount(left.candidate) - newCourseCount(right.candidate)
            || left.candidate.length - right.candidate.length
            || left.index - right.index;
        })[0]?.candidate;
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
          ...planningContext,
        }));
        prerequisiteQueue.push(prerequisiteCode);
      });
      prerequisiteQueue.sort();
    }

    (input.wishlistCourses || []).forEach((course) => {
      if (validCode(course?.code) && !completed.has(course.code) && !normalizedByCode.has(course.code)) {
        normalizedByCode.set(course.code, normalizedCourse(course, { optional: true, ...planningContext }));
      }
    });
    Object.values(input.schedule || {}).forEach((entry) => {
      const course = entry?.course || entry;
      const explicitlyPinned = entry?.userPinned === true || entry?.locked === true;
      if (explicitlyPinned && validCode(entry?.code) && !completed.has(entry.code) && !normalizedByCode.has(entry.code)) {
        normalizedByCode.set(entry.code, normalizedCourse(
          { ...course, code: entry.code, credits: entry.credits, title: entry.fullTitle || entry.title },
          planningContext,
        ));
      }
    });

    const prerequisitePathsByCode = {};
    const enforceablePrerequisitePathsByCode = {};
    normalizedByCode.forEach((course) => {
      if (course.prerequisitePaths.length) prerequisitePathsByCode[course.code] = course.prerequisitePaths;
      if (course.enforceablePrerequisitePaths.length) {
        enforceablePrerequisitePathsByCode[course.code] = course.enforceablePrerequisitePaths;
      }
    });

    const issues = [...normalizedByCode.values()].filter((course) => course.creditsEstimated).map((course) => ({
      code: "estimated_course_credits",
      severity: "warning",
      courseCode: course.code,
      estimatedCredits: course.credits,
    }));

    const lockedPlacements = Object.fromEntries(pinnedScheduleEntries
      .map((entry) => [entry.code, { ...entry, locked: true, userPinned: true }]));

    const result = {
      terms: Array.isArray(input.terms) ? input.terms : [],
      courses: [...normalizedByCode.values()].sort((left, right) => left.code.localeCompare(right.code)),
      completedCourseCodes: [...completed].sort(),
      lockedPlacements,
      prerequisitePathsByCode,
      enforceablePrerequisitePathsByCode,
      unresolvedRequirements,
      confirmedCredits: Number.isFinite(Number(input.confirmedCredits)) ? Math.max(0, Number(input.confirmedCredits)) : 0,
      issues,
    };
    return {
      ...result,
      planningDecisions: root.ScheduleRURequirementChoiceLogic?.planningDecisions(result) || [],
    };
  }

  function applyApprovedCourseSet(input, optimization) {
    if (optimization?.status !== "complete") return input;
    const remainingAllocations = new Map();
    (optimization.selectedCourses || []).forEach((course) => {
      (course.coverageRequirementIds || []).forEach((id) => {
        remainingAllocations.set(id, (remainingAllocations.get(id) || 0) + 1);
      });
    });
    const unresolvedRequirements = (input.unresolvedRequirements || []).filter((requirement) => {
      const decisionId = `${requirement.sourceType === "core" ? "core" : "program"}:${text(requirement.sourceProgram)}:${text(requirement.requirementGroupId)}`;
      const remaining = remainingAllocations.get(decisionId) || 0;
      if (!remaining) return true;
      remainingAllocations.set(decisionId, remaining - 1);
      return false;
    });
    const byCode = new Map((input.courses || []).map((course) => [course.code, course]));
    (optimization.selectedCourses || []).forEach((course) => {
      if (validCode(course?.code)) byCode.set(course.code, { ...course });
    });
    const prerequisitePathsByCode = { ...(input.prerequisitePathsByCode || {}) };
    const enforceablePrerequisitePathsByCode = { ...(input.enforceablePrerequisitePathsByCode || {}) };
    byCode.forEach((course) => {
      if (course.prerequisitePaths?.length) prerequisitePathsByCode[course.code] = course.prerequisitePaths;
      if (course.enforceablePrerequisitePaths?.length) {
        enforceablePrerequisitePathsByCode[course.code] = course.enforceablePrerequisitePaths;
      }
    });
    const result = {
      ...input,
      courses: [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code)),
      unresolvedRequirements,
      prerequisitePathsByCode,
      enforceablePrerequisitePathsByCode,
    };
    return {
      ...result,
      planningDecisions: root.ScheduleRURequirementChoiceLogic?.planningDecisions(result) || [],
    };
  }

  root.ScheduleRUPlannerInput = { buildPlannerInput, applyApprovedCourseSet, numericCredits, standingFromText, normalizedCourse };
})(globalThis);
