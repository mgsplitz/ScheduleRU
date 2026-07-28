/*
 * Deterministic, browser-safe four-year planning rules. This module owns no
 * state: callers supply reviewed inputs and decide whether to accept a plan.
 */
(function exposeFourYearPlanner(root) {
  const DEFAULT_TARGET = 16;
  const DEFAULT_MAX = 18;
  const DEFAULT_MAX_COURSES = 6;
  const DEFAULT_FEASIBILITY_SEARCH_STATES = 50000;

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
        prerequisitePaths: normalizedPaths(requirement?.prerequisitePaths),
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
    const feasibilitySearchMaxStates = Math.max(1, Math.floor(positiveNumber(
      input.feasibilitySearchMaxStates,
      DEFAULT_FEASIBILITY_SEARCH_STATES,
    )));
    const confirmedCredits = nonNegativeNumber(input.confirmedCredits, 0);
    const inputIssues = (Array.isArray(input.issues) ? input.issues : []).map((entry) => ({ ...entry }));
    return { terms, courses, coursesByCode, completedCourseCodes, lockedPlacements, prerequisitePathsByCode, unresolvedRequirements, targetCredits, maxCredits, maxCoursesPerTerm, feasibilitySearchMaxStates, confirmedCredits, inputIssues };
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
      prerequisitePaths: normalizedPaths(requirement.prerequisitePaths),
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

  function requirementAllowedInTerm(normalized, requirement, term, schedule) {
    if (!requirement.prerequisitePaths.length) return true;
    return requirement.prerequisitePaths.some((path) => {
      const prerequisiteOrdinal = pathPlacementOrdinal(path, normalized.completedCourseCodes, schedule);
      return prerequisiteOrdinal !== null && prerequisiteOrdinal < term.ordinal;
    });
  }

  function requiredFeasibilityItems(normalized) {
    return [
      ...normalized.courses.filter((course) => !course.optional).map((course) => ({
        key: `course:${course.code}`,
        type: "course",
        code: course.code,
        label: course.title || course.code,
        credits: course.credits,
        minimumOrdinal: course.minimumPlanYear === null ? 0 : (course.minimumPlanYear - 1) * 2,
        minimumPriorCredits: course.minimumPriorCredits,
        prerequisitePaths: prerequisitePathsFor(normalized, course.code),
        corequisitePaths: course.corequisitePaths,
        lockedOrdinal: normalized.lockedPlacements[course.code]?.ordinal ?? null,
        course,
      })),
      ...normalized.unresolvedRequirements.map((requirement) => ({
        key: `requirement:${requirement.inputOrdinal}:${requirement.id}`,
        type: "requirement",
        code: null,
        label: requirement.label,
        credits: requirement.credits,
        minimumOrdinal: 0,
        minimumPriorCredits: null,
        prerequisitePaths: requirement.prerequisitePaths.length ? requirement.prerequisitePaths : [[]],
        corequisitePaths: [],
        lockedOrdinal: null,
        requirement,
      })),
    ];
  }

  function earliestFeasibilityOrdinals(normalized, items) {
    const courses = new Map(items.filter((item) => item.type === "course").map((item) => [item.code, item]));
    const memo = new Map();
    function earliestCourse(code, visiting = new Set()) {
      if (normalized.completedCourseCodes.has(code)) return -1;
      if (memo.has(code)) return memo.get(code);
      const item = courses.get(code);
      if (!item || visiting.has(code)) return Number.POSITIVE_INFINITY;
      const next = new Set(visiting);
      next.add(code);
      const pathOrdinals = item.prerequisitePaths.map((path) => {
        let latest = -1;
        for (const prerequisite of path) {
          const ordinal = earliestCourse(prerequisite, next);
          if (!Number.isFinite(ordinal)) return Number.POSITIVE_INFINITY;
          latest = Math.max(latest, ordinal);
        }
        return latest + 1;
      });
      const prerequisiteOrdinal = pathOrdinals.length
        ? Math.min(...pathOrdinals)
        : 0;
      const earliest = Math.max(item.minimumOrdinal, prerequisiteOrdinal);
      memo.set(code, earliest);
      return earliest;
    }
    return new Map(items.map((item) => {
      if (item.type === "course") return [item.key, earliestCourse(item.code)];
      const pathOrdinals = item.prerequisitePaths.map((path) => {
        let latest = -1;
        for (const prerequisite of path) {
          const ordinal = earliestCourse(prerequisite);
          if (!Number.isFinite(ordinal)) return Number.POSITIVE_INFINITY;
          latest = Math.max(latest, ordinal);
        }
        return latest + 1;
      });
      return [item.key, pathOrdinals.length ? Math.min(...pathOrdinals) : 0];
    }));
  }

  function sequencingCapacityIssue(normalized, items, earliestByKey) {
    const lastTermOrdinal = normalized.terms.at(-1)?.ordinal ?? -1;
    const beyondHorizon = items.filter((item) => {
      const earliest = earliestByKey.get(item.key);
      return !Number.isFinite(earliest) || earliest > lastTermOrdinal
        || (item.lockedOrdinal !== null && earliest > item.lockedOrdinal);
    });
    if (beyondHorizon.length) {
      const earliestTermOrdinal = Math.min(...beyondHorizon.map((item) => earliestByKey.get(item.key)));
      return issue("plan_sequence_capacity_exceeded", "error", {
        courseCodes: beyondHorizon.map((item) => item.code).filter(Boolean).sort(),
        requirementLabels: beyondHorizon.filter((item) => !item.code).map((item) => item.label).sort(),
        earliestTermOrdinal,
        lastTermOrdinal,
      });
    }

    const firstTermOrdinal = normalized.terms[0]?.ordinal ?? 0;
    for (const start of normalized.terms.map((term) => term.ordinal).filter((ordinal) => ordinal > firstTermOrdinal)) {
      const constrained = items.filter((item) => earliestByKey.get(item.key) >= start);
      const availableTerms = normalized.terms.filter((term) => term.ordinal >= start).length;
      const requiredCredits = constrained.reduce((total, item) => total + item.credits, 0);
      const availableCredits = availableTerms * normalized.maxCredits;
      const availableItems = availableTerms * normalized.maxCoursesPerTerm;
      if (requiredCredits <= availableCredits && constrained.length <= availableItems) continue;
      return issue("plan_sequence_capacity_exceeded", "error", {
        courseCodes: constrained.map((item) => item.code).filter(Boolean).sort(),
        requirementLabels: constrained.filter((item) => !item.code).map((item) => item.label).sort(),
        startTermOrdinal: start,
        requiredCredits,
        availableCredits,
        requiredItems: constrained.length,
        availableItems,
        lastTermOrdinal,
      });
    }
    return null;
  }

  function searchFeasibleAssignments(normalized, items, earliestByKey) {
    const itemByCourse = new Map(items.filter((item) => item.type === "course").map((item) => [item.code, item]));
    const assignment = new Map();
    const creditsByOrdinal = Object.fromEntries(normalized.terms.map((term) => [term.ordinal, 0]));
    const countByOrdinal = Object.fromEntries(normalized.terms.map((term) => [term.ordinal, 0]));
    let states = 0;
    let exhausted = false;

    function reserve(item, ordinal) {
      assignment.set(item.key, ordinal);
      creditsByOrdinal[ordinal] += item.credits;
      countByOrdinal[ordinal] += 1;
    }
    function release(item, ordinal) {
      assignment.delete(item.key);
      creditsByOrdinal[ordinal] -= item.credits;
      countByOrdinal[ordinal] -= 1;
    }
    for (const item of items.filter((candidate) => candidate.lockedOrdinal !== null)) {
      if (!Object.prototype.hasOwnProperty.call(creditsByOrdinal, item.lockedOrdinal)
        || creditsByOrdinal[item.lockedOrdinal] + item.credits > normalized.maxCredits
        || countByOrdinal[item.lockedOrdinal] >= normalized.maxCoursesPerTerm) {
        return { status: "unsatisfiable", assignments: null, states };
      }
      reserve(item, item.lockedOrdinal);
    }

    function pathCanFit(path, ordinal, sameTermAllowed) {
      return path.every((code) => {
        if (normalized.completedCourseCodes.has(code)) return true;
        const prerequisiteItem = itemByCourse.get(code);
        if (!prerequisiteItem) return false;
        const assigned = assignment.get(prerequisiteItem.key);
        if (assigned !== undefined) return sameTermAllowed ? assigned <= ordinal : assigned < ordinal;
        const earliest = earliestByKey.get(prerequisiteItem.key);
        return Number.isFinite(earliest) && (sameTermAllowed ? earliest <= ordinal : earliest < ordinal);
      });
    }

    function priorCredits(ordinal) {
      return normalized.confirmedCredits + Object.entries(creditsByOrdinal).reduce((total, [candidateOrdinal, credits]) => (
        Number(candidateOrdinal) < ordinal ? total + credits : total
      ), 0);
    }

    function potentialPriorCredits(item, ordinal) {
      return priorCredits(ordinal) + items.reduce((total, candidate) => {
        if (candidate.key === item.key || assignment.has(candidate.key)) return total;
        if (candidate.lockedOrdinal !== null) {
          return candidate.lockedOrdinal < ordinal ? total + candidate.credits : total;
        }
        return candidate.minimumOrdinal < ordinal ? total + candidate.credits : total;
      }, 0);
    }

    function candidateOrdinals(item) {
      if (item.lockedOrdinal !== null) return assignment.has(item.key) ? [] : [item.lockedOrdinal];
      return normalized.terms.map((term) => term.ordinal).filter((ordinal) => {
        if (ordinal < item.minimumOrdinal) return false;
        if (creditsByOrdinal[ordinal] + item.credits > normalized.maxCredits) return false;
        if (countByOrdinal[ordinal] >= normalized.maxCoursesPerTerm) return false;
        if (item.minimumPriorCredits !== null
          && potentialPriorCredits(item, ordinal) < item.minimumPriorCredits) return false;
        if (item.prerequisitePaths.length
          && !item.prerequisitePaths.some((path) => pathCanFit(path, ordinal, false))) return false;
        if (item.corequisitePaths.length
          && !item.corequisitePaths.some((path) => pathCanFit(path, ordinal, true))) return false;
        return true;
      }).sort((left, right) => {
        const leftTarget = creditsByOrdinal[left] + item.credits <= normalized.targetCredits ? 0 : 1;
        const rightTarget = creditsByOrdinal[right] + item.credits <= normalized.targetCredits ? 0 : 1;
        return leftTarget - rightTarget
          || creditsByOrdinal[left] - creditsByOrdinal[right]
          || countByOrdinal[left] - countByOrdinal[right]
          || left - right;
      });
    }

    function finalConstraintsHold() {
      return items.every((item) => {
        const ordinal = assignment.get(item.key);
        if (ordinal === undefined) return false;
        if (item.minimumPriorCredits !== null && priorCredits(ordinal) < item.minimumPriorCredits) return false;
        if (item.prerequisitePaths.length
          && !item.prerequisitePaths.some((path) => pathCanFit(path, ordinal, false))) return false;
        return !item.corequisitePaths.length
          || item.corequisitePaths.some((path) => pathCanFit(path, ordinal, true));
      });
    }

    function visit() {
      states += 1;
      if (states > normalized.feasibilitySearchMaxStates) {
        exhausted = true;
        return false;
      }
      const remaining = items.filter((item) => !assignment.has(item.key));
      if (!remaining.length) return finalConstraintsHold();
      const choices = remaining.map((item) => ({ item, ordinals: candidateOrdinals(item) }))
        .sort((left, right) => left.ordinals.length - right.ordinals.length
          || Number(right.item.minimumPriorCredits !== null) - Number(left.item.minimumPriorCredits !== null)
          || right.item.minimumOrdinal - left.item.minimumOrdinal
          || right.item.credits - left.item.credits
          || left.item.key.localeCompare(right.item.key));
      const choice = choices[0];
      if (!choice.ordinals.length) return false;
      for (const ordinal of choice.ordinals) {
        reserve(choice.item, ordinal);
        if (visit()) return true;
        release(choice.item, ordinal);
        if (exhausted) return false;
      }
      return false;
    }

    const found = visit();
    return {
      status: found ? "complete" : exhausted ? "indeterminate" : "unsatisfiable",
      assignments: found ? new Map(assignment) : null,
      states,
    };
  }

  function applyFeasibleAssignments(normalized, items, assignments, schedule, termCredits, placeholders) {
    Object.keys(schedule).forEach((code) => delete schedule[code]);
    Object.keys(termCredits).forEach((key) => { termCredits[key] = 0; });
    placeholders.splice(0, placeholders.length);
    const termByOrdinal = new Map(normalized.terms.map((term) => [term.ordinal, term]));
    items.forEach((item) => {
      const ordinal = assignments.get(item.key);
      const term = termByOrdinal.get(ordinal);
      if (!term) return;
      termCredits[termKey(term)] += item.credits;
      if (item.type === "course") {
        const locked = item.lockedOrdinal !== null;
        schedule[item.code] = {
          ...item.course,
          code: item.code,
          credits: item.credits,
          year: term.year,
          sem: term.sem,
          ordinal,
          locked,
          userPinned: locked,
        };
        return;
      }
      const placeholder = createPlaceholder(item.requirement, ordinal);
      placeholder.year = term.year;
      placeholder.sem = term.sem;
      placeholders.push(placeholder);
    });
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
    const requiredCredits = normalized.courses
      .filter((course) => !course.optional)
      .reduce((total, course) => total + course.credits, 0)
      + normalized.unresolvedRequirements.reduce((total, requirement) => total + requirement.credits, 0);
    const availableCredits = normalized.terms.length * normalized.maxCredits;
    const feasibilityItems = requiredFeasibilityItems(normalized);
    const earliestByKey = earliestFeasibilityOrdinals(normalized, feasibilityItems);
    if (requiredCredits > availableCredits) {
      issues.push(issue("plan_capacity_exceeded", "error", {
        requiredCredits,
        availableCredits,
        overByCredits: requiredCredits - availableCredits,
      }));
    }
    const availableItems = normalized.terms.length * normalized.maxCoursesPerTerm;
    if (feasibilityItems.length > availableItems) {
      issues.push(issue("plan_course_slots_exceeded", "error", {
        requiredItems: feasibilityItems.length,
        availableItems,
        overByItems: feasibilityItems.length - availableItems,
      }));
    }
    const sequenceIssue = sequencingCapacityIssue(normalized, feasibilityItems, earliestByKey);
    if (sequenceIssue) issues.push(sequenceIssue);

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

    let unplacedCourses = [...pending.values()].filter((course) => !course.optional).map((course) => course.code).sort();
    let unplacedOptionalCourses = [...pending.values()].filter((course) => course.optional).map((course) => course.code).sort();
    const cyclic = cyclicCourseCodes(unplacedCourses, normalized);

    const placeholders = [];
    let unplacedRequirements = [];
    normalized.unresolvedRequirements.forEach((requirement) => {
      const eligibleTerms = normalized.terms
        .filter((term) => termCredits[termKey(term)] + requirement.credits <= normalized.maxCredits
          && courseCountForOrdinal(schedule, term.ordinal) + placeholders.filter((entry) => entry.termOrdinal === term.ordinal).length < normalized.maxCoursesPerTerm
          && requirementAllowedInTerm(normalized, requirement, term, schedule))
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

    const proofIssueCodes = new Set([
      "plan_capacity_exceeded",
      "plan_course_slots_exceeded",
      "plan_sequence_capacity_exceeded",
    ]);
    const hasProof = issues.some((entry) => proofIssueCodes.has(entry.code));
    if ((unplacedCourses.length || unplacedRequirements.length) && !hasProof && !cyclic.length) {
      const search = searchFeasibleAssignments(normalized, feasibilityItems, earliestByKey);
      if (search.status === "complete") {
        applyFeasibleAssignments(normalized, feasibilityItems, search.assignments, schedule, termCredits, placeholders);
        unplacedCourses = [];
        unplacedRequirements = [];
        unplacedOptionalCourses = normalized.courses.filter((course) => course.optional).map((course) => course.code).sort();
        for (let index = issues.length - 1; index >= 0; index -= 1) {
          if (["locked_prerequisite_violation", "courses_unplaced", "requirements_unplaced"].includes(issues[index].code)) {
            issues.splice(index, 1);
          }
        }
      } else if (search.status === "indeterminate") {
        issues.push(issue("plan_feasibility_inconclusive", "error", {
          searchedStates: search.states,
          courseCodes: unplacedCourses,
          requirementIds: [...unplacedRequirements].sort(),
        }));
      } else {
        issues.push(issue("plan_sequence_capacity_exceeded", "error", {
          courseCodes: unplacedCourses,
          requirementIds: [...unplacedRequirements].sort(),
          lastTermOrdinal: normalized.terms.at(-1)?.ordinal ?? -1,
        }));
      }
    }

    if (cyclic.length) issues.push(issue("cyclic_prerequisite", "error", { courseCodes: cyclic }));
    if (unplacedCourses.length) issues.push(issue("courses_unplaced", "error", { courseCodes: unplacedCourses }));
    if (unplacedOptionalCourses.length) issues.push(issue("optional_courses_unplaced", "warning", { courseCodes: unplacedOptionalCourses }));
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
