/*
 * Deterministic, browser-safe four-year planning rules. This module owns no
 * state: callers supply reviewed inputs and decide whether to accept a plan.
 */
(function exposeFourYearPlanner(root) {
  const DEFAULT_TARGET = 16;
  const DEFAULT_MAX = 18;
  const DEFAULT_MAX_COURSES = 6;

  function termOrdinal(term) {
    const year = Number(term?.year);
    const sem = String(term?.sem || "").toLowerCase();
    if (!Number.isInteger(year) || year < 1 || (sem !== "fall" && sem !== "spring")) return null;
    return (year - 1) * 2 + (sem === "fall" ? 0 : 1);
  }

  function termKey(term) {
    return `${Number(term.year)}:${String(term.sem).toLowerCase()}`;
  }

  function courseCode(value) {
    const code = String(value || "").trim();
    return code || null;
  }

  function nonNegativeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function normalizedPaths(rawPaths) {
    if (!Array.isArray(rawPaths)) return [];
    const unique = new Map();
    rawPaths.filter(Array.isArray).forEach((path) => {
      const normalized = [...new Set(path.map(courseCode).filter(Boolean))].sort();
      if (normalized.length) unique.set(normalized.join("\u0000"), normalized);
    });
    return [...unique.values()].sort((left, right) => left.join("\u0000").localeCompare(right.join("\u0000")));
  }

  function stableText(value) {
    return String(value || "").trim();
  }

  function normalizeTargetCredits(value) {
    if (!Number.isFinite(value)) return DEFAULT_TARGET;
    return Math.max(14, Math.min(DEFAULT_TARGET, value));
  }

  function normalizePlannerInput(input = {}) {
    const termsByKey = new Map();
    (Array.isArray(input.terms) ? input.terms : []).forEach((term) => {
      const ordinal = termOrdinal(term);
      if (ordinal === null) return;
      const normalized = { year: Number(term.year), sem: String(term.sem).toLowerCase(), ordinal };
      termsByKey.set(termKey(normalized), normalized);
    });
    const terms = [...termsByKey.values()].sort((left, right) => left.ordinal - right.ordinal || termKey(left).localeCompare(termKey(right)));

    const courseCandidates = (Array.isArray(input.courses) ? input.courses : [])
      .map((course) => ({
        code: courseCode(course?.code),
        credits: positiveNumber(course?.credits, 3),
        title: stableText(course?.title),
        creditsEstimated: course?.creditsEstimated === true || !(Number(course?.credits) > 0),
        optional: course?.optional === true,
        prerequisiteOnly: course?.prerequisiteOnly === true,
        minimumPlanYear: Number.isInteger(Number(course?.minimumPlanYear)) ? Math.max(1, Number(course.minimumPlanYear)) : null,
        minimumPriorCredits: Number.isFinite(Number(course?.minimumPriorCredits)) ? Math.max(0, Number(course.minimumPriorCredits)) : null,
        corequisitePaths: normalizedPaths(course?.corequisitePaths),
        ruleCoverage: stableText(course?.ruleCoverage) || "unresolved",
      }))
      .filter((course) => course.code)
      .sort((left, right) => Number(left.optional) - Number(right.optional)
        || left.code.localeCompare(right.code) || left.credits - right.credits || left.title.localeCompare(right.title));
    const coursesByCode = new Map();
    courseCandidates.forEach((course) => {
      if (!coursesByCode.has(course.code)) coursesByCode.set(course.code, course);
    });
    const courses = [...coursesByCode.values()];

    const completedCourseCodes = new Set((Array.isArray(input.completedCourseCodes) ? input.completedCourseCodes : [])
      .map(courseCode)
      .filter(Boolean));

    const prerequisitePathsByCode = {};
    Object.keys(input.prerequisitePathsByCode || {}).map(courseCode).filter(Boolean).sort().forEach((code) => {
      prerequisitePathsByCode[code] = normalizedPaths(input.prerequisitePathsByCode[code]);
    });

    const lockedPlacements = {};
    Object.keys(input.lockedPlacements || {}).map(courseCode).filter(Boolean).sort().forEach((code) => {
      const placement = input.lockedPlacements[code];
      const ordinal = termOrdinal(placement);
      lockedPlacements[code] = {
        code,
        year: Number(placement?.year),
        sem: String(placement?.sem || "").toLowerCase(),
        ordinal,
        credits: positiveNumber(coursesByCode.get(code)?.credits ?? placement?.credits, 3),
      };
    });

    const unresolvedRequirements = (Array.isArray(input.unresolvedRequirements) ? input.unresolvedRequirements : [])
      .map((requirement) => ({
        id: stableText(requirement?.id),
        label: stableText(requirement?.label) || "Unresolved requirement",
        credits: nonNegativeNumber(requirement?.credits, 3),
        sourceType: stableText(requirement?.sourceType) || "requirement",
        sourceProgram: stableText(requirement?.sourceProgram || requirement?.programId),
        requirementGroupId: stableText(requirement?.requirementGroupId || requirement?.groupId || requirement?.id),
        candidateSelectionContext: requirement?.candidateSelectionContext ?? requirement?.candidateContext ?? null,
      }))
      .sort((left, right) => left.sourceType.localeCompare(right.sourceType)
        || left.id.localeCompare(right.id)
        || left.label.localeCompare(right.label)
        || left.credits - right.credits)
      .map((requirement, index) => ({ ...requirement, inputOrdinal: index }));

    const suppliedMaximum = nonNegativeNumber(input.maxCredits, DEFAULT_MAX);
    const maxCredits = Math.min(suppliedMaximum, DEFAULT_MAX);
    const targetCredits = normalizeTargetCredits(input.targetCredits);
    const maxCoursesPerTerm = Math.max(1, Math.min(DEFAULT_MAX_COURSES, Math.floor(positiveNumber(input.maxCoursesPerTerm, DEFAULT_MAX_COURSES))));
    const confirmedCredits = nonNegativeNumber(input.confirmedCredits, 0);
    const inputIssues = (Array.isArray(input.issues) ? input.issues : []).map((entry) => ({ ...entry }));
    return { terms, courses, coursesByCode, completedCourseCodes, lockedPlacements, prerequisitePathsByCode, unresolvedRequirements, targetCredits, maxCredits, maxCoursesPerTerm, confirmedCredits, inputIssues };
  }

  function createPlaceholder(requirement = {}, ordinal) {
    const sourceType = stableText(requirement.sourceType) || "requirement";
    const requirementId = stableText(requirement.id) || "unresolved";
    const inputOrdinal = Number.isInteger(requirement.inputOrdinal) ? requirement.inputOrdinal : 0;
    return {
      id: `placeholder:${sourceType}:${requirementId}:${Number(ordinal)}:${inputOrdinal}`,
      kind: "requirement_placeholder",
      sourceType,
      sourceProgram: stableText(requirement.sourceProgram),
      requirementGroupId: stableText(requirement.requirementGroupId) || requirementId,
      label: stableText(requirement.label) || "Unresolved requirement",
      estimatedCredits: nonNegativeNumber(requirement.credits, 3),
      credits: nonNegativeNumber(requirement.credits, 3),
      candidateSelectionContext: requirement.candidateSelectionContext ?? null,
      termOrdinal: Number(ordinal),
    };
  }

  function issue(code, severity, details = {}) {
    return { code, severity, ...details };
  }

  function prerequisitePathsFor(input, code) {
    return Object.prototype.hasOwnProperty.call(input.prerequisitePathsByCode, code)
      ? input.prerequisitePathsByCode[code]
      : [[]];
  }

  function pathPlacementOrdinal(path, completedCourseCodes, schedule) {
    let latest = -1;
    for (const prerequisite of path) {
      if (completedCourseCodes.has(prerequisite)) continue;
      const placement = schedule[prerequisite];
      if (!placement) return null;
      latest = Math.max(latest, placement.ordinal);
    }
    return latest;
  }

  function courseCountForOrdinal(schedule, ordinal) {
    return Object.values(schedule).filter((placement) => placement?.ordinal === ordinal).length;
  }

  function plannedCreditsBefore(schedule, ordinal) {
    return Object.values(schedule).reduce((total, placement) => (
      placement?.ordinal < ordinal ? total + positiveNumber(placement.credits, 0) : total
    ), 0);
  }

  function projectedRequirementCredits(normalized) {
    const creditsByOrdinal = Object.fromEntries(normalized.terms.map((term) => [term.ordinal, 0]));
    normalized.unresolvedRequirements.forEach((requirement) => {
      const candidates = normalized.terms
        .filter((term) => creditsByOrdinal[term.ordinal] + requirement.credits <= normalized.maxCredits)
        .sort((left, right) => creditsByOrdinal[left.ordinal] - creditsByOrdinal[right.ordinal]
          || left.ordinal - right.ordinal);
      const term = candidates[0];
      if (term) creditsByOrdinal[term.ordinal] += requirement.credits;
    });
    return creditsByOrdinal;
  }

  function projectedCreditsBefore(creditsByOrdinal, ordinal) {
    return Object.entries(creditsByOrdinal || {}).reduce((total, [termOrdinal, credits]) => (
      Number(termOrdinal) < ordinal ? total + positiveNumber(credits, 0) : total
    ), 0);
  }

  function corequisiteSatisfied(course, completedCourseCodes, schedule, ordinal) {
    if (!course.corequisitePaths.length) return true;
    return course.corequisitePaths.some((path) => path.every((code) => (
      completedCourseCodes.has(code) || (schedule[code] && schedule[code].ordinal <= ordinal)
    )));
  }

  function courseAllowedInTerm(normalized, course, term, schedule, projectedRequirementCreditsByOrdinal = {}) {
    if (courseCountForOrdinal(schedule, term.ordinal) >= normalized.maxCoursesPerTerm) return false;
    if (course.minimumPlanYear !== null && term.year < course.minimumPlanYear) return false;
    if (course.minimumPriorCredits !== null
      && normalized.confirmedCredits
        + plannedCreditsBefore(schedule, term.ordinal)
        + projectedCreditsBefore(projectedRequirementCreditsByOrdinal, term.ordinal) < course.minimumPriorCredits) return false;
    return corequisiteSatisfied(course, normalized.completedCourseCodes, schedule, term.ordinal);
  }

  function placeLockedPrerequisiteClosures(normalized, schedule, termCredits, pending, projectedRequirementCreditsByOrdinal = {}) {
    const MAX_SEARCH_STATES = 4096;
    const MAX_BRANCH_STATES = 256;
    let searchStates = 0;

    function cloneState(state) {
      return {
        schedule: { ...state.schedule },
        termCredits: { ...state.termCredits },
        pending: new Map(state.pending),
      };
    }

    function candidateTerms(state, course, deadline) {
      const eligible = normalized.terms.filter((term) => term.ordinal < deadline
        && state.termCredits[termKey(term)] + course.credits <= normalized.maxCredits
        && courseAllowedInTerm(normalized, course, term, state.schedule, projectedRequirementCreditsByOrdinal));
      const target = eligible.filter((term) => state.termCredits[termKey(term)] + course.credits <= normalized.targetCredits);
      const overflow = eligible.filter((term) => !target.includes(term));
      const compare = (left, right) => left.ordinal - right.ordinal
        || state.termCredits[termKey(left)] - state.termCredits[termKey(right)]
        || termKey(left).localeCompare(termKey(right));
      return target.sort(compare).concat(overflow.sort(compare));
    }

    function planPathBefore(path, deadline, state, ancestors) {
      let states = [state];
      for (const prerequisite of path) {
        const nextStates = [];
        for (const candidate of states) {
          nextStates.push(...planCourseBefore(prerequisite, deadline, candidate, ancestors));
          if (nextStates.length >= MAX_BRANCH_STATES) break;
        }
        states = nextStates.slice(0, MAX_BRANCH_STATES);
        if (!states.length) break;
      }
      return states;
    }

    function planCourseBefore(code, deadline, state, ancestors) {
      if (searchStates >= MAX_SEARCH_STATES) return [];
      searchStates += 1;
      if (normalized.completedCourseCodes.has(code)) return [state];
      const existing = state.schedule[code];
      if (existing) return existing.ordinal < deadline ? [state] : [];
      if (ancestors.has(code)) return [];
      const course = state.pending.get(code);
      if (!course) return [];

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(code);
      const terms = candidateTerms(state, course, deadline);
      const results = [];
      for (const path of prerequisitePathsFor(normalized, code)) {
        for (const term of terms) {
          const prerequisiteStates = planPathBefore(path, term.ordinal, state, nextAncestors);
          for (const prerequisiteState of prerequisiteStates) {
            if (prerequisiteState.termCredits[termKey(term)] + course.credits > normalized.maxCredits) continue;
            const placed = cloneState(prerequisiteState);
            placed.schedule[code] = {
              code,
              credits: course.credits,
              year: term.year,
              sem: term.sem,
              ordinal: term.ordinal,
              locked: false,
            };
            placed.termCredits[termKey(term)] += course.credits;
            placed.pending.delete(code);
            results.push(placed);
            if (results.length >= MAX_BRANCH_STATES) return results;
          }
        }
      }
      return results;
    }

    const lockedCourses = Object.keys(schedule).filter((code) => schedule[code]?.locked)
      .sort((left, right) => schedule[left].ordinal - schedule[right].ordinal || left.localeCompare(right));
    const initialState = cloneState({ schedule, termCredits, pending });
    let best = { satisfied: -1, state: initialState };

    function planLockedCourses(index, state, satisfied) {
      if (satisfied > best.satisfied) best = { satisfied, state };
      if (index === lockedCourses.length) return satisfied === lockedCourses.length ? state : null;
      if (searchStates >= MAX_SEARCH_STATES) return null;

      const code = lockedCourses[index];
      for (const path of prerequisitePathsFor(normalized, code)) {
        const candidates = planPathBefore(path, schedule[code].ordinal, state, new Set([code]));
        for (const candidate of candidates) {
          const complete = planLockedCourses(index + 1, candidate, satisfied + 1);
          if (complete) return complete;
        }
      }
      planLockedCourses(index + 1, state, satisfied);
      return null;
    }

    const planned = planLockedCourses(0, initialState, 0) || best.state;
    Object.assign(schedule, planned.schedule);
    Object.keys(termCredits).forEach((key) => { termCredits[key] = planned.termCredits[key]; });
    pending.clear();
    planned.pending.forEach((course, code) => pending.set(code, course));
  }

  function cyclicCourseCodes(codes, normalized) {
    const remaining = new Set(codes);
    const edges = new Map(codes.map((code) => [code, new Set()]));
    codes.forEach((code) => {
      prerequisitePathsFor(normalized, code).forEach((path) => {
        if (path.every((prerequisite) => remaining.has(prerequisite))) {
          path.forEach((prerequisite) => edges.get(code).add(prerequisite));
        }
      });
    });

    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const cyclic = new Set();
    let index = 0;
    function visit(code) {
      indices.set(code, index);
      lowLinks.set(code, index);
      index += 1;
      stack.push(code);
      onStack.add(code);
      [...edges.get(code)].sort().forEach((next) => {
        if (!indices.has(next)) {
          visit(next);
          lowLinks.set(code, Math.min(lowLinks.get(code), lowLinks.get(next)));
        } else if (onStack.has(next)) {
          lowLinks.set(code, Math.min(lowLinks.get(code), indices.get(next)));
        }
      });
      if (lowLinks.get(code) !== indices.get(code)) return;
      const component = [];
      let next;
      do {
        next = stack.pop();
        onStack.delete(next);
        component.push(next);
      } while (next !== code);
      if (component.length > 1 || edges.get(code).has(code)) component.forEach((member) => cyclic.add(member));
    }
    codes.slice().sort().forEach((code) => { if (!indices.has(code)) visit(code); });
    return [...cyclic].sort();
  }

  function generatePlan(input = {}) {
    const normalized = normalizePlannerInput(input);
    const projectedRequirementCreditsByOrdinal = projectedRequirementCredits(normalized);
    const schedule = {};
    const termCredits = Object.fromEntries(normalized.terms.map((term) => [termKey(term), 0]));
    const issues = [...normalized.inputIssues];
    const termsByKey = new Map(normalized.terms.map((term) => [termKey(term), term]));

    normalized.courses.filter((course) => course.ruleCoverage === "unresolved").forEach((course) => {
      if (!issues.some((entry) => entry.code === "eligibility_rule_unresolved" && entry.courseCode === course.code)) {
        issues.push(issue("eligibility_rule_unresolved", "warning", { courseCode: course.code }));
      }
    });

    Object.keys(normalized.lockedPlacements).sort().forEach((code) => {
      const locked = normalized.lockedPlacements[code];
      const term = locked.ordinal === null ? null : termsByKey.get(`${locked.year}:${locked.sem}`);
      if (!term) {
        issues.push(issue("invalid_locked_placement", "error", { courseCode: code }));
        return;
      }
      const course = normalized.coursesByCode.get(code) || {};
      schedule[code] = { ...course, code, credits: locked.credits, year: term.year, sem: term.sem, ordinal: term.ordinal, locked: true, userPinned: true };
      termCredits[termKey(term)] += locked.credits;
    });

    normalized.terms.forEach((term) => {
      if (termCredits[termKey(term)] > normalized.maxCredits) {
        issues.push(issue("locked_credit_cap_exceeded", "error", { term: termKey(term), maxCredits: normalized.maxCredits }));
      }
      if (courseCountForOrdinal(schedule, term.ordinal) > normalized.maxCoursesPerTerm) {
        issues.push(issue("locked_course_cap_exceeded", "error", { term: termKey(term), maxCourses: normalized.maxCoursesPerTerm }));
      }
    });

    const pending = new Map(normalized.courses
      .filter((course) => !normalized.completedCourseCodes.has(course.code) && !schedule[course.code])
      .map((course) => [course.code, course]));

    placeLockedPrerequisiteClosures(normalized, schedule, termCredits, pending, projectedRequirementCreditsByOrdinal);
    const prerequisiteDemand = new Set();
    [...pending.keys()].forEach((dependentCode) => {
      prerequisitePathsFor(normalized, dependentCode).forEach((path) => path.forEach((prerequisiteCode) => {
        if (pending.has(prerequisiteCode)) prerequisiteDemand.add(prerequisiteCode);
      }));
    });
    function placePendingCourses(courseCodes) {
      let placedInPass = true;
      while (placedInPass) {
        placedInPass = false;
        courseCodes.forEach((code) => {
          if (!pending.has(code)) return;
          const course = pending.get(code);
          const choices = prerequisitePathsFor(normalized, code).flatMap((path) => {
            const prerequisiteOrdinal = pathPlacementOrdinal(path, normalized.completedCourseCodes, schedule);
            if (prerequisiteOrdinal === null) return [];
            return normalized.terms
              .filter((term) => term.ordinal > prerequisiteOrdinal
                && termCredits[termKey(term)] + course.credits <= normalized.maxCredits
                && courseAllowedInTerm(normalized, course, term, schedule, projectedRequirementCreditsByOrdinal))
              .map((term) => ({ term, prerequisiteOrdinal }));
          });
          const targetChoices = choices.filter(({ term }) => termCredits[termKey(term)] + course.credits <= normalized.targetCredits);
          const preferredChoices = targetChoices.length ? targetChoices : choices;
          preferredChoices.sort((left, right) => (prerequisiteDemand.has(code) ? left.term.ordinal - right.term.ordinal : 0)
            || termCredits[termKey(left.term)] - termCredits[termKey(right.term)]
            || courseCountForOrdinal(schedule, left.term.ordinal) - courseCountForOrdinal(schedule, right.term.ordinal)
            || left.term.ordinal - right.term.ordinal);
          const choice = preferredChoices[0];
          if (!choice) return;
          const term = choice.term;
          schedule[code] = { ...course, code, credits: course.credits, year: term.year, sem: term.sem, ordinal: term.ordinal, locked: false, userPinned: false };
          termCredits[termKey(term)] += course.credits;
          pending.delete(code);
          placedInPass = true;
        });
      }
    }
    const requiredCodes = [...pending.values()].filter((course) => !course.optional).map((course) => course.code).sort();
    const optionalCodes = [...pending.values()].filter((course) => course.optional).map((course) => course.code).sort();
    placePendingCourses(requiredCodes);
    placePendingCourses(optionalCodes);

    Object.keys(normalized.lockedPlacements).filter((code) => schedule[code]?.locked).sort().forEach((code) => {
      const paths = prerequisitePathsFor(normalized, code);
      if (paths.length && !paths.some((path) => {
        const prerequisiteOrdinal = pathPlacementOrdinal(path, normalized.completedCourseCodes, schedule);
        return prerequisiteOrdinal !== null && prerequisiteOrdinal < schedule[code].ordinal;
      })) {
        issues.push(issue("locked_prerequisite_violation", "error", { courseCode: code }));
      }
    });

    const unplacedCourses = [...pending.values()].filter((course) => !course.optional).map((course) => course.code).sort();
    const unplacedOptionalCourses = [...pending.values()].filter((course) => course.optional).map((course) => course.code).sort();
    const cyclic = cyclicCourseCodes(unplacedCourses, normalized);
    if (cyclic.length) issues.push(issue("cyclic_prerequisite", "error", { courseCodes: cyclic }));
    if (unplacedCourses.length) issues.push(issue("courses_unplaced", "error", { courseCodes: unplacedCourses }));
    if (unplacedOptionalCourses.length) issues.push(issue("optional_courses_unplaced", "warning", { courseCodes: unplacedOptionalCourses }));

    const placeholders = [];
    const unplacedRequirements = [];
    normalized.unresolvedRequirements.forEach((requirement) => {
      const eligibleTerms = normalized.terms
        .filter((term) => termCredits[termKey(term)] + requirement.credits <= normalized.maxCredits
          && courseCountForOrdinal(schedule, term.ordinal) + placeholders.filter((entry) => entry.termOrdinal === term.ordinal).length < normalized.maxCoursesPerTerm)
      const targetTerms = eligibleTerms.filter((term) => termCredits[termKey(term)] + requirement.credits <= normalized.targetCredits);
      const candidates = (targetTerms.length ? targetTerms : eligibleTerms)
        .sort((left, right) => termCredits[termKey(left)] - termCredits[termKey(right)]
          || courseCountForOrdinal(schedule, left.ordinal) - courseCountForOrdinal(schedule, right.ordinal)
          || left.ordinal - right.ordinal
          || termKey(left).localeCompare(termKey(right)));
      const term = candidates[0];
      if (!term) {
        unplacedRequirements.push(requirement.id || requirement.label);
        return;
      }
      const placeholder = createPlaceholder(requirement, term.ordinal);
      placeholder.year = term.year;
      placeholder.sem = term.sem;
      placeholders.push(placeholder);
      termCredits[termKey(term)] += placeholder.estimatedCredits;
    });
    if (unplacedRequirements.length) issues.push(issue("requirements_unplaced", "error", { requirementIds: unplacedRequirements.sort() }));

    const resultSchedule = {};
    Object.keys(schedule).sort().forEach((code) => {
      const { ordinal, ...placement } = schedule[code];
      resultSchedule[code] = placement;
    });
    return {
      status: issues.some((entry) => entry.severity === "error") ? "partial" : "complete",
      schedule: resultSchedule,
      placeholders,
      issues,
      assumptions: [
        "Reviewed and safely parsed prerequisite paths are enforced; unresolved eligibility remains visible as a warning.",
        `Automatic planning uses a ${normalized.maxCredits}-credit hard cap per term.`,
        `Automatic planning uses a ${normalized.maxCoursesPerTerm}-course hard cap per term.`,
        `Automatic planning targets ${normalized.targetCredits} credits per term.`,
      ],
      termCredits,
    };
  }

  root.ScheduleRUFourYearPlanner = { generatePlan, normalizePlannerInput, createPlaceholder };
})(globalThis);
